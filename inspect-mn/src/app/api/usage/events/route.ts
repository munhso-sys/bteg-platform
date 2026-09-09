import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordUsageEvent } from "@/lib/usage/record";
import type { UsageEventKind } from "@/lib/usage/types";

export const dynamic = "force-dynamic";

const ALLOWED: UsageEventKind[] = ["login", "module_view"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 });
  }

  let body: {
    kind?: string;
    module?: string;
    path?: string;
    detail?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const kind = body.kind as UsageEventKind | undefined;
  if (!kind || !ALLOWED.includes(kind)) {
    return NextResponse.json({ ok: false, error: "Invalid kind" }, { status: 400 });
  }

  await recordUsageEvent({
    kind,
    userId: user.id,
    email: user.email ?? null,
    module: body.module ?? null,
    path: body.path ?? null,
    detail: body.detail ?? null,
  });

  return NextResponse.json({ ok: true });
}
