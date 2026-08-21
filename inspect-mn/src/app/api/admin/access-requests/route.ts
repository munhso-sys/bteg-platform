import { NextResponse } from "next/server";
import { inviteEmailHtml, sendTransactionalEmail } from "@/lib/email/resend";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import type { RoleId } from "@/lib/rbac/types";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function GET() {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;

  const { admin } = ctx;
  const { data, error } = await admin
    .from("access_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: data ?? [] });
}

type PatchBody = {
  id?: string;
  action?: "approve" | "reject";
  role_id?: RoleId;
  review_note?: string;
};

export async function DELETE(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "id шаардлагатай" },
      { status: 400 },
    );
  }

  const { error } = await admin.from("access_requests").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function findUserIdByEmail(
  admin: AdminClient,
  email: string,
): Promise<string | null> {
  const normalized = email.toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data: listed } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    const found = listed?.users?.find(
      (u) => u.email?.toLowerCase() === normalized,
    );
    if (found) return found.id;
    if (!listed?.users?.length || listed.users.length < 200) break;
  }
  return null;
}

export async function PATCH(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const { user, admin } = ctx;

  const body = (await req.json()) as PatchBody;
  if (!body.id || !body.action) {
    return NextResponse.json(
      { ok: false, error: "id, action шаардлагатай" },
      { status: 400 },
    );
  }

  const { data: request, error: fetchErr } = await admin
    .from("access_requests")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();

  if (fetchErr || !request) {
    return NextResponse.json(
      { ok: false, error: fetchErr?.message ?? "Хүсэлт олдсонгүй" },
      { status: 404 },
    );
  }

  if (request.status !== "pending") {
    return NextResponse.json(
      { ok: false, error: "Энэ хүсэлт аль хэдийн шийдэгдсэн." },
      { status: 409 },
    );
  }

  if (body.action === "reject") {
    const { error } = await admin
      .from("access_requests")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: body.review_note ?? null,
      })
      .eq("id", body.id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  const role_id = body.role_id ?? "employee";
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://bteg.inspect.mn";
  const redirectTo = `${site}/auth/callback?next=/update-password`;

  let position_id = (request.position_id as string | null) ?? null;
  let position_name = (request.position_name as string | null) ?? null;
  if (position_id || position_name) {
    try {
      const { getDutyModuleApps } = await import("@/lib/module-apps");
      const origin = getDutyModuleApps()["policy-compliance"].origin;
      const url = new URL(`${origin}/api/positions/resolve`);
      if (position_id) url.searchParams.set("id", position_id);
      if (position_name) url.searchParams.set("name", position_name);
      const res = await fetch(url.toString(), {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          id?: string;
          name?: string;
        };
        if (data.ok && data.id) {
          position_id = data.id;
          position_name = data.name || position_name;
        }
      }
    } catch {
      // keep original position_id
    }
  }

  // Avoid Supabase built-in invite email (≈2/hour rate limit).
  // Ensure auth user exists, then generate recovery link and send via Resend.
  // Do NOT call generateLink({ type: "invite" }) after createUser — invite
  // tries to create again and fails with "already been registered".
  let createdUserId = await findUserIdByEmail(admin, request.email);

  if (!createdUserId) {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: request.email,
        email_confirm: true,
        user_metadata: {
          full_name: request.full_name,
          phone: request.phone,
        },
      });
    if (createErr || !created.user?.id) {
      const msg = (createErr?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        createdUserId = await findUserIdByEmail(admin, request.email);
      }
      if (!createdUserId) {
        return NextResponse.json(
          {
            ok: false,
            error: createErr?.message ?? "Хэрэглэгч үүсгэж чадсангүй",
          },
          { status: 500 },
        );
      }
    } else {
      createdUserId = created.user.id;
    }
  }

  const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: request.email,
      options: { redirectTo },
    });

  const { appAuthLinkFromGenerate } = await import("@/lib/auth/app-auth-link");
  const inviteUrl = appAuthLinkFromGenerate({
    siteUrl: site,
    hashedToken: linkData?.properties?.hashed_token ?? null,
    type: "recovery",
    next: "/update-password",
    fallbackActionLink: linkData?.properties?.action_link ?? null,
  });

  if (linkErr && !inviteUrl) {
    console.warn("[access-requests] generateLink failed:", linkErr.message);
  }

  let emailSent = false;
  let emailError: string | null = null;
  if (inviteUrl) {
    const mailed = await sendTransactionalEmail({
      to: request.email,
      subject: "Inspect Platform — нэвтрэх эрх баталгаажлаа",
      html: inviteEmailHtml({
        fullName: request.full_name,
        inviteUrl,
        siteUrl: site,
      }),
      text: `Сайн байна уу, ${request.full_name}.\n\nНэвтрэх эрх баталгаажлаа. Нууц үг тохируулах:\n${inviteUrl}\n`,
    });
    if (mailed.ok) {
      emailSent = true;
    } else {
      emailError = mailed.skipped
        ? "RESEND_API_KEY тохируулаагүй эсвэл redeploy хийгээгүй"
        : mailed.error;
    }
  } else {
    emailError = linkErr?.message ?? "Урилгын холбоос үүсээгүй";
  }

  const { error: profileErr } = await admin.from("user_profiles").upsert({
    user_id: createdUserId,
    email: request.email,
    full_name: request.full_name,
    phone: request.phone,
    heltes_id: request.heltes_id,
    heltes_name: request.heltes_name,
    alba_id: request.alba_id,
    alba_name: request.alba_name,
    position_id,
    position_name,
    role_id,
    status: "active",
    updated_at: new Date().toISOString(),
  });

  if (profileErr) {
    return NextResponse.json(
      { ok: false, error: profileErr.message },
      { status: 500 },
    );
  }

  const { error: updErr } = await admin
    .from("access_requests")
    .update({
      status: "approved",
      assigned_role_id: role_id,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: body.review_note ?? null,
      created_user_id: createdUserId,
    })
    .eq("id", body.id);

  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    status: "approved",
    user_id: createdUserId,
    email_sent: emailSent,
    email_error: emailError,
    invite_url: emailSent ? null : inviteUrl,
  });
}
