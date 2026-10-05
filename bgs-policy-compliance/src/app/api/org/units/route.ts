import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAlbaUnit,
  createHeltesUnit,
  createOrganizationLabel,
  deleteAlbaUnit,
  deleteHeltesUnit,
  deleteOrganizationLabel,
  listManagedOrgUnits,
  listOrgAssignTree,
} from "@/lib/db/org";

const createSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("organization"),
    name: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("heltes"),
    name: z.string().trim().min(1),
    alba_name: z.string().trim().min(1).nullable().optional(),
  }),
  z.object({
    kind: z.literal("alba"),
    heltes_id: z.string().trim().min(1),
    name: z.string().trim().min(1),
  }),
]);

const deleteSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("organization"),
    id: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("heltes"),
    heltes_id: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("alba"),
    heltes_id: z.string().trim().min(1),
    alba_id: z.string().trim().min(1),
  }),
]);

export async function GET(req: Request) {
  try {
    const view = new URL(req.url).searchParams.get("view");
    if (view === "managed") {
      const units = await listManagedOrgUnits();
      return NextResponse.json({ ok: true, ...units });
    }
    const tree = await listOrgAssignTree();
    return NextResponse.json({ ok: true, tree });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const body = createSchema.parse(await req.json());
    if (body.kind === "organization") {
      const created = await createOrganizationLabel(body.name);
      return NextResponse.json({ ok: true, ...created }, { status: 201 });
    }
    if (body.kind === "heltes") {
      const created = await createHeltesUnit({
        name: body.name,
        alba_name: body.alba_name,
      });
      return NextResponse.json({ ok: true, ...created }, { status: 201 });
    }
    const created = await createAlbaUnit({
      heltes_id: body.heltes_id,
      name: body.name,
    });
    return NextResponse.json({ ok: true, ...created }, { status: 201 });
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

export async function DELETE(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const body = deleteSchema.parse(await req.json());
    if (body.kind === "organization") {
      const result = await deleteOrganizationLabel(body.id);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.kind === "heltes") {
      const result = await deleteHeltesUnit({ heltes_id: body.heltes_id });
      return NextResponse.json({ ok: true, ...result });
    }
    const result = await deleteAlbaUnit({
      heltes_id: body.heltes_id,
      alba_id: body.alba_id,
    });
    return NextResponse.json({ ok: true, ...result });
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
