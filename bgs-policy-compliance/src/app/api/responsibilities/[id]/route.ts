import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deactivateResponsibility,
  updateResponsibilityMeta,
  updateResponsibilityType,
} from "@/lib/db/repository";

const patchSchema = z
  .object({
    responsibility_type: z
      .enum([
        "IMPLEMENTATION",
        "MONITORING",
        "VERIFICATION",
        "DEPLOYMENT",
      ])
      .optional(),
    weight: z.number().finite().optional(),
    required_evidence: z.string().nullable().optional(),
    process_id: z.string().nullable().optional(),
    location_id: z.string().nullable().optional(),
    asset_id: z.string().nullable().optional(),
  })
  .refine(
    (v) =>
      v.responsibility_type !== undefined ||
      v.weight !== undefined ||
      v.required_evidence !== undefined ||
      v.process_id !== undefined ||
      v.location_id !== undefined ||
      v.asset_id !== undefined,
    { message: "Хадгалах өгөгдөл байхгүй" },
  );

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    let mode: "updated" | "merged" | "unchanged" | "meta" = "unchanged";

    if (body.responsibility_type !== undefined) {
      const result = await updateResponsibilityType(id, body.responsibility_type);
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: "Холбоос олдсонгүй" },
          { status: 404 },
        );
      }
      mode = result.mode;
    }

    if (
      body.weight !== undefined ||
      body.required_evidence !== undefined ||
      body.process_id !== undefined ||
      body.location_id !== undefined ||
      body.asset_id !== undefined
    ) {
      const ok = await updateResponsibilityMeta(id, {
        weight: body.weight,
        required_evidence: body.required_evidence,
        process_id: body.process_id,
        location_id: body.location_id,
        asset_id: body.asset_id,
      });
      if (!ok) {
        return NextResponse.json(
          { ok: false, error: "Холбоос олдсонгүй" },
          { status: 404 },
        );
      }
      if (mode === "unchanged") mode = "meta";
    }

    return NextResponse.json({ ok: true, mode });
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
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const { id } = await params;
    const found = await deactivateResponsibility(id);
    if (!found) {
      return NextResponse.json(
        { ok: false, error: "Холбоос олдсонгүй" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
