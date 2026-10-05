import { requirePolicyMutation } from "@/lib/access/scope";
import { parseUploadedJobDescriptionFile } from "@/lib/job-description/parse-uploaded";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Файл сонгоогүй байна." },
        { status: 400 },
      );
    }

    const result = await parseUploadedJobDescriptionFile(file);
    return NextResponse.json({
      ok: true,
      fields: result.fields,
      warnings: result.warnings,
      characterCount: result.characterCount,
      fileName: result.fileName,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Файлыг задалж чадсангүй";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
