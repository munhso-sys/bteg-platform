import { NextResponse } from "next/server";
import { getInspectionScope } from "@/lib/access/scope";
import { isUnitScopedInspection } from "@/lib/access/embed";
import {
  deleteOrgTemplateAllocation,
  readOrgTemplateAllocations,
  upsertOrgTemplateAllocation,
} from "@/lib/org-template/store";
import type { AllocatedTemplateRef } from "@/lib/org-template/types";

export const dynamic = "force-dynamic";

async function denyIfUnitScoped() {
  const scope = await getInspectionScope();
  if (isUnitScopedInspection(scope)) {
    return NextResponse.json(
      { ok: false, error: "Нэгжийн хэрэглэгч засах эрхгүй" },
      { status: 403 },
    );
  }
  return null;
}

export async function GET() {
  const store = await readOrgTemplateAllocations();
  return NextResponse.json({ ok: true, ...store });
}

export async function PUT(req: Request) {
  const denied = await denyIfUnitScoped();
  if (denied) return denied;

  const body = (await req.json()) as {
    heltesId?: string;
    heltesName?: string;
    albaId?: string;
    albaName?: string;
    templates?: AllocatedTemplateRef[];
  };

  if (!body.heltesId?.trim() || !body.albaId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "heltesId, albaId шаардлагатай" },
      { status: 400 },
    );
  }

  const row = await upsertOrgTemplateAllocation({
    heltesId: body.heltesId.trim(),
    heltesName: body.heltesName?.trim() || body.heltesId,
    albaId: body.albaId.trim(),
    albaName: body.albaName?.trim() || body.albaId,
    templates: Array.isArray(body.templates) ? body.templates : [],
  });

  return NextResponse.json({ ok: true, allocation: row });
}

export async function DELETE(req: Request) {
  const denied = await denyIfUnitScoped();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const heltesId = searchParams.get("heltesId");
  const albaId = searchParams.get("albaId");
  if (!heltesId || !albaId) {
    return NextResponse.json(
      { ok: false, error: "heltesId, albaId шаардлагатай" },
      { status: 400 },
    );
  }
  const ok = await deleteOrgTemplateAllocation(heltesId, albaId);
  if (!ok) {
    return NextResponse.json(
      { ok: false, error: "Бүртгэл олдсонгүй" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
