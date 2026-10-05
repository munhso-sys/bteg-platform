import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import type { RoleId } from "@/lib/rbac/types";

export async function GET() {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const [{ data: users, error: uErr }, { data: roles }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("*")
      .order("full_name", { ascending: true }),
    admin.from("roles").select("id, label, description, sort_order").order("sort_order"),
  ]);

  if (uErr) {
    return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    users: users ?? [],
    roles: roles ?? [],
  });
}

type PatchBody = {
  user_id?: string;
  role_id?: RoleId;
  /** UI: active | inactive. Stored as active | suspended. */
  status?: "active" | "inactive" | "suspended" | "pending";
};

function toDbStatus(
  status: PatchBody["status"],
): "active" | "suspended" | "pending" | null {
  if (!status) return null;
  if (status === "active") return "active";
  if (status === "inactive" || status === "suspended") return "suspended";
  if (status === "pending") return "pending";
  return null;
}

export async function PATCH(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const { admin, user: actor } = ctx;

  const body = (await req.json()) as PatchBody;
  if (!body.user_id) {
    return NextResponse.json(
      { ok: false, error: "user_id шаардлагатай" },
      { status: 400 },
    );
  }

  const dbStatus = toDbStatus(body.status);
  if (body.status && !dbStatus) {
    return NextResponse.json(
      { ok: false, error: "status: active | inactive" },
      { status: 400 },
    );
  }

  if (dbStatus && dbStatus !== "active" && body.user_id === actor.id) {
    return NextResponse.json(
      { ok: false, error: "Өөрийн нэвтрэх эрхийг Inactive болгох боломжгүй" },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.role_id) patch.role_id = body.role_id;
  if (dbStatus) patch.status = dbStatus;

  const { data, error } = await admin
    .from("user_profiles")
    .update(patch)
    .eq("user_id", body.user_id)
    .select("user_id, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Хэрэглэгчийн профайл олдсонгүй" },
      { status: 404 },
    );
  }

  // Block / restore Auth login when status changes.
  if (dbStatus === "suspended" || dbStatus === "pending") {
    const { error: banErr } = await admin.auth.admin.updateUserById(
      body.user_id,
      { ban_duration: "876000h" },
    );
    if (banErr) {
      console.error("[users] ban failed:", banErr.message);
      return NextResponse.json(
        {
          ok: false,
          error: `Төлөв хадгалагдсан боловч нэвтрэх эрх хаахад алдаа: ${banErr.message}`,
        },
        { status: 500 },
      );
    }
  } else if (dbStatus === "active") {
    const { error: unbanErr } = await admin.auth.admin.updateUserById(
      body.user_id,
      { ban_duration: "none" },
    );
    if (unbanErr) {
      console.error("[users] unban failed:", unbanErr.message);
      return NextResponse.json(
        {
          ok: false,
          error: `Төлөв хадгалагдсан боловч нэвтрэх эрх сэргээхэд алдаа: ${unbanErr.message}`,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, status: data.status });
}
