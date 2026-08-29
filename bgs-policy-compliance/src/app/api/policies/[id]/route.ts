import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deletePolicy,
  getPolicyDetail,
  updatePolicy,
} from "@/lib/db/repository";
import type { ClauseTreeNode } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const detail = await getPolicyDetail(id);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Журам олдсонгүй" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      policy: {
        id: detail.policy.id,
        name: detail.policy.name,
        reference_code: detail.policy.reference_code,
        approved_date: detail.policy.approved_date,
        status: detail.policy.status,
      },
      avgScore: detail.avgScore,
      scope: detail.scope.map((s) => ({
        id: String(s.id),
        target_type: s.target_type,
        target_name: s.target_name,
        target_bteg_id: s.target_bteg_id,
      })),
      sections: detail.trees.map(({ section, tree }) => ({
        id: section.id,
        reference_number: section.reference_number,
        text: section.text,
        title: `Хэсэг ${section.reference_number || ""} ${section.text || ""}`.trim(),
        clauses: flattenClauses(tree),
      })),
      positionCount: detail.positions.length,
      responsibilityCount: detail.responsibilities.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  reference_code: z.string().nullable().optional(),
  approved_date: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const updated = await updatePolicy(id, body);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Журам олдсонгүй" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, policy: updated });
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const found = await deletePolicy(id);
    if (!found) {
      return NextResponse.json(
        { ok: false, error: "Журам олдсонгүй" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function flattenClauses(
  nodes: ClauseTreeNode[],
  depth = 0,
): Array<{
  id: string;
  reference_number: string | null;
  text: string;
  depth: number;
  link_count: number;
}> {
  const out: Array<{
    id: string;
    reference_number: string | null;
    text: string;
    depth: number;
    link_count: number;
  }> = [];
  for (const n of nodes) {
    out.push({
      id: n.id,
      reference_number: n.reference_number,
      text: n.text,
      depth,
      link_count: n.responsibilities?.length ?? 0,
    });
    if (n.children.length) out.push(...flattenClauses(n.children, depth + 1));
  }
  return out;
}
