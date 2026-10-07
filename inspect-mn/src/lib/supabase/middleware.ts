import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";

const AUTH_TIMEOUT_MS = 8_000;

async function getUserWithTimeout(
  supabase: ReturnType<typeof createServerClient>,
) {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), AUTH_TIMEOUT_MS),
      ),
    ]);
    if (!result) return null;
    return result.data.user ?? null;
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const nextWithPath = () =>
    NextResponse.next({ request: { headers: requestHeaders } });

  let response = nextWithPath();

  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = nextWithPath();
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const user = await getUserWithTimeout(supabase);

  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login";
  const isAuthPublic =
    isLogin ||
    pathname === "/access-request" ||
    pathname === "/forgot-password" ||
    pathname === "/update-password" ||
    pathname.startsWith("/auth/");
  const isPublicApi =
    pathname === "/api/supabase/health" ||
    pathname === "/api/runtime-info" ||
    pathname === "/api/org/options" ||
    pathname === "/api/access-requests" ||
    pathname === "/api/auth/forgot-password" ||
    pathname.startsWith("/api/modules/") ||
    pathname === "/api/reports/distribute" ||
    pathname === "/api/telegram/voice-webhook";

  if (isPublicApi || pathname.startsWith("/auth/")) {
    return response;
  }

  if (!user && !isAuthPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (isLogin || pathname === "/access-request")) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile && profile.status !== "active") {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("reason", "inactive");
      return NextResponse.redirect(redirectUrl);
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  // Kick inactive / suspended users from protected app routes.
  if (user && !isAuthPublic) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile && profile.status !== "active") {
      await supabase.auth.signOut();
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("reason", "inactive");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
