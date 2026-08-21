import { NextResponse } from "next/server";
import {
  inviteEmailHtml,
  sendTransactionalEmail,
} from "@/lib/email/resend";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Password reset via Resend — bypasses Supabase built-in email rate limit (~2/hr).
 */
export async function POST(req: Request) {
  if (!hasServiceRole()) {
    return NextResponse.json(
      { ok: false, error: "Серверийн тохиргоо дутуу (service role)." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Имэйл хаяг буруу байна." },
      { status: 400 },
    );
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://bteg.inspect.mn";
  const redirectTo = `${site}/auth/callback?next=/update-password`;

  // Always return generic success to avoid email enumeration.
  const genericOk = {
    ok: true,
    message:
      "Хэрэв энэ имэйлээр бүртгэлтэй бол нууц үг шинэчлэх холбоос илгээгдлээ.",
  };

  try {
    const admin = createAdminClient();
    const { data: linkData, error: linkErr } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

  const { appAuthLinkFromGenerate } = await import("@/lib/auth/app-auth-link");
  const actionLink = appAuthLinkFromGenerate({
    siteUrl: site,
    hashedToken: linkData?.properties?.hashed_token ?? null,
    type: "recovery",
    next: "/update-password",
    fallbackActionLink: linkData?.properties?.action_link ?? null,
  });
  if (linkErr || !actionLink) {
    // User may not exist — still return generic ok.
    console.warn(
      "[forgot-password] generateLink:",
      linkErr?.message ?? "no link",
    );
    return NextResponse.json(genericOk);
  }

  const mailed = await sendTransactionalEmail({
    to: email,
    subject: "Inspect Platform — нууц үг шинэчлэх",
    html: inviteEmailHtml({
      fullName: email,
      inviteUrl: actionLink,
      siteUrl: site,
    }),
    text: `Нууц үг шинэчлэх холбоос:\n${actionLink}\n`,
  });

    if (!mailed.ok) {
      console.warn("[forgot-password] Resend:", mailed.error);
      // Do not fall back to Supabase SMTP (rate limited).
      return NextResponse.json(
        {
          ok: false,
          error:
            mailed.skipped
              ? "Имэйл үйлчилгээ тохируулаагүй (RESEND_API_KEY)."
              : `Имэйл илгээгдсэнгүй: ${mailed.error}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(genericOk);
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Алдаа гарлаа",
      },
      { status: 500 },
    );
  }
}
