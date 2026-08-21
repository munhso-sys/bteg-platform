import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/update-password";
  const safeNext = next.startsWith("/") ? next : "/update-password";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Auth тохиргоо дутуу.")}`,
    );
  }

  const response = NextResponse.redirect(`${origin}${safeNext}`);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let ok = false;
  let detail = "";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    detail = error?.message ?? "";
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    ok = !error;
    detail = error?.message ?? "";
  }

  if (ok) {
    return response;
  }

  console.warn("[auth/callback] failed:", detail || "missing code/token_hash");
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "Нууц үг сэргээх холбоос хүчингүй эсвэл хугацаа дууссан. Шинэ холбоос авна уу.",
    )}`,
  );
}
