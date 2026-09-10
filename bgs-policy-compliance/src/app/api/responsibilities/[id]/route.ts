import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deactivateResponsibility,
  updateResponsibilityType,
} from "@/lib/db/repository";

const patchSchema = z.object({
  responsibility_type: z.enum([
    "IMPLEMENTATION",
    "MONITORING",
    "VERIFICATION",
    "DEPLOYMENT",
  ]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const result = await updateResponsibilityType(id, body.responsibility_type);
    if (result.ok) {
      return NextResponse.json({ ok: true, mode: result.mode });
    }
    return NextResponse.json(
      { ok: false, error: "Холбоос олдсонгүй" },
      { status: 404 },
    );
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
