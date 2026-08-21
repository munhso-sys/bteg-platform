import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null;
  const projectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;

  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      projectRef,
      url,
      error: "Missing NEXT_PUBLIC_SUPABASE_URL or key",
    });
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });

    const body = await res.text();
    const ok = res.ok;

    return NextResponse.json({
      ok,
      projectRef,
      url,
      projectName: "inspect-bteg",
      accountHint: "corporation0214-hue",
      status: res.status,
      detail: body.slice(0, 200),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        projectRef,
        url,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
