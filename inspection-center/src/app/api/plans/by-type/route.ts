import { NextResponse } from "next/server";
import { requireInspectionWriteAccess } from "@/lib/access/scope";
import { applyAnnualPlanByTypeForm } from "@/lib/plans/by-type-save";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Fast path for «Баталгаажуулах» modals — avoids Next.js Server Action
 * refresh/404 issues inside the portal iframe when remote store flush is slow.
 */
export async function POST(req: Request) {
  const gate = await requireInspectionWriteAccess();
  if (gate.error) return gate.error;

  try {
    const formData = await req.formData();
    const result = await applyAnnualPlanByTypeForm(formData);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Төлөвлөгөө хадгалж чадсангүй";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
