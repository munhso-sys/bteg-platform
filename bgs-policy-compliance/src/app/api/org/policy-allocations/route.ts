import { NextResponse } from "next/server";
import { requirePolicyMutation } from "@/lib/access/scope";
import {
  listUnitPolicyAllocations,
  setUnitPolicyAllocations,
} from "@/lib/db/org";
import { getDb } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const [allocations, db] = await Promise.all([
    listUnitPolicyAllocations(),
    getDb(),
  ]);
  const policies = db.policies
    .filter((p) => !p.is_deleted && p.status !== "archived")
    .map((p) => ({
      id: p.id,
      name: p.name,
      reference_code: p.reference_code ?? null,
      status: p.status,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "mn"));

  return NextResponse.json({ ok: true, allocations, policies });
}

export async function PUT(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;

  const body = (await req.json()) as {
    heltesId?: string;
    albaId?: string;
    policyIds?: string[];
    policyNames?: Record<string, string>;
  };

  if (!body.heltesId?.trim() || !body.albaId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "heltesId, albaId шаардлагатай" },
      { status: 400 },
    );
  }

  await setUnitPolicyAllocations({
    heltes_id: body.heltesId.trim(),
    alba_id: body.albaId.trim(),
    policy_ids: Array.isArray(body.policyIds) ? body.policyIds : [],
    policy_names: body.policyNames,
  });

  const allocations = await listUnitPolicyAllocations();
  return NextResponse.json({ ok: true, allocations });
}
