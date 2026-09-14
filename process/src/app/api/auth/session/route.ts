import { NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createUserServerClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured" },
      { status: 503 },
    );
  }

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

  return NextResponse.json({
    ok: true,
    userId: data.session.user.id,
  });
}

export async function DELETE() {
  const supabase = await createUserServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: true });
  }
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
