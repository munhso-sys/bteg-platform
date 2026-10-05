import { NextResponse } from "next/server";
import {
  createSessionCookieClient,
  createUserServerClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Probe whether cookies or an Authorization Bearer already authenticate. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const supabase = await createUserServerClient(request);
  if (!supabase) {
    return NextResponse.json(
      { ok: false, authenticated: false, error: "Supabase is not configured" },
      { status: 503 },
    );
  }
  const jwt = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : undefined;
  const {
    data: { user },
  } = jwt ? await supabase.auth.getUser(jwt) : await supabase.auth.getUser();
  return NextResponse.json({
    ok: true,
    authenticated: Boolean(user),
    userId: user?.id ?? null,
  });
}

/** Establish a Supabase session cookie from portal-posted tokens (not from rd_uid). */
export async function POST(request: Request) {
  let body: { access_token?: string; refresh_token?: string };
  try {
    body = (await request.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const access_token = body.access_token?.trim();
  const refresh_token = body.refresh_token?.trim();
  if (!access_token || !refresh_token) {
    return NextResponse.json(
      { ok: false, error: "access_token and refresh_token required" },
      { status: 400 },
    );
  }

  // Placeholder response — cookie writes attach to this object, then we return it
  // with the final JSON body via a cloned Set-Cookie set.
  const cookieResponse = NextResponse.json({ ok: true });
  const supabase = await createSessionCookieClient(cookieResponse);
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (error || !data.session) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Session rejected" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    userId: data.session.user.id,
  });
  for (const cookie of cookieResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}

export async function DELETE() {
  const cookieResponse = NextResponse.json({ ok: true });
  const supabase = await createSessionCookieClient(cookieResponse);
  if (!supabase) {
    return NextResponse.json({ ok: true });
  }
  await supabase.auth.signOut();
  const response = NextResponse.json({ ok: true });
  for (const cookie of cookieResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}
