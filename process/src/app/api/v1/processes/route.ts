import { NextResponse } from "next/server";
import { createNode, listNodes } from "@/lib/store";
import { createProcessSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** POST /api/v1/processes — create process node */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createProcessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const node = await createNode(parsed.data);
    return NextResponse.json({ data: node }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("already exists")
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/** GET /api/v1/processes — flat list */
export async function GET() {
  const nodes = await listNodes();
  return NextResponse.json({ data: nodes });
}
