import { NextResponse } from "next/server";
import { embedSrc, getDutyModuleApps } from "@/lib/module-apps";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const apps = getDutyModuleApps();
  const app = apps[id as keyof typeof apps];
  if (!app) {
    return NextResponse.json({ ok: false, reason: "unknown" }, { status: 404 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(embedSrc(app), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "text/html" },
      cache: "no-store",
    });
    clearTimeout(timer);
    const ok = res.status > 0 && res.status < 500;
    return NextResponse.json({
      ok,
      status: res.status,
      origin: app.origin,
    });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({
      ok: false,
      reason: "unreachable",
      origin: app.origin,
    });
  }
}
