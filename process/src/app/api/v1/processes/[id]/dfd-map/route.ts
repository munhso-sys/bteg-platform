import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertDfdMaps } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const mapSchema = z.object({
  maps: z
    .array(
      z.object({
        diagram_node_id: z.string().min(1),
        label: z.string().min(1),
        dfd_level: z.enum(["L0_CONTEXT", "L1_FLOW", "L2_DETAIL"]),
        element_kind: z.enum([
          "PROCESS",
          "EXTERNAL_ENTITY",
          "DATA_STORE",
          "DATA_FLOW",
        ]),
        data_input: z.array(z.string()).default([]),
        data_output: z.array(z.string()).default([]),
        data_store_reference: z.string().nullable().optional(),
        api_payload_schema: z.string().nullable().optional(),
        data_dictionary: z.record(z.string()).default({}),
        notes: z.string().nullable().optional(),
        file_id: z.string().nullable().optional(),
      }),
    )
    .min(1),
});

/** POST /api/v1/processes/:id/dfd-map */
export async function POST(request: Request, ctx: Ctx) {
  const { id: processId } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = mapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const saved = await upsertDfdMaps(
      processId,
      parsed.data.maps.map((m) => ({
        process_id: processId,
        diagram_node_id: m.diagram_node_id,
        label: m.label,
        dfd_level: m.dfd_level,
        element_kind: m.element_kind,
        data_input: m.data_input,
        data_output: m.data_output,
        data_store_reference: m.data_store_reference ?? null,
        api_payload_schema: m.api_payload_schema ?? null,
        data_dictionary: m.data_dictionary,
        notes: m.notes ?? null,
        file_id: m.file_id ?? null,
      })),
    );
    return NextResponse.json({ data: saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : "DFD map failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
