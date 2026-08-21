import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listPositionsForOrgTree,
  setPositionOrgAssignment,
} from "@/lib/db/org";
import { createPosition } from "@/lib/db/repository";
import { OTHER_ALBA_ID, OTHER_HELTES_ID } from "@/lib/org-assign";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const limit = Number(searchParams.get("limit") || 100);
  const rows = (await listPositionsForOrgTree(q)).slice(0, Math.max(1, limit));
  return NextResponse.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      heltesId: p.heltesId,
      albaId: p.albaId,
      heltes: p.heltes,
      alba: p.alba,
    })),
  );
}

const schema = z.object({
  name: z.string().min(1),
  bteg_id: z.string().nullable().optional(),
  organization_id: z.string().nullable().optional(),
  organization_name: z.string().nullable().optional(),
  gazar_id: z.string().nullable().optional(),
  heltes_id: z.string().nullable().optional(),
  alba_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const body = schema.parse(await req.json());
    const heltesId = body.heltes_id?.trim() || OTHER_HELTES_ID;
    const albaId = body.alba_id?.trim() || OTHER_ALBA_ID;
    const position = await createPosition({
      name: body.name,
      bteg_id: body.bteg_id,
      organization_id: body.organization_id,
      organization_name: body.organization_name,
      gazar_id: body.gazar_id,
      description: body.description,
    });
    await setPositionOrgAssignment({
      position_id: position.id,
      organization_name: body.organization_name ?? null,
      heltes_id: heltesId,
      alba_id: albaId,
    });
    return NextResponse.json(position, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Буруу өгөгдөл", details: err.flatten() },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
