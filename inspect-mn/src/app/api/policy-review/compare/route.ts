import { NextResponse } from "next/server";
import { requireAiAccess } from "@/lib/ai/access";
import { extractUploadedDocument } from "@/lib/policy-review/extract";
import { chunkDocument } from "@/lib/policy-review/chunk";
import { comparePolicyDocuments } from "@/lib/policy-review/compare";
import { readAiScopeConfig } from "@/lib/ai/scope-config-store";
import { resolveAiDataScope } from "@/lib/ai/resolve-scope";
import { loadStoredPoliciesForComparison } from "@/lib/policy-review/stored-policies";
import { registerPolicyReviewSession } from "@/lib/policy-review/review-session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const access = await requireAiAccess();
  if (access.error) return access.error;

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const policyIds = formData
      .getAll("policyIds")
      .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
    const focus = String(formData.get("focus") ?? "").trim().slice(0, 1200);
    const sourceCount = files.length + new Set(policyIds).size;

    if (sourceCount < 2) {
      return NextResponse.json(
        { ok: false, error: "Дотоод сан эсвэл файлаас хамгийн багадаа 2 баримт сонгоно уу." },
        { status: 400 },
      );
    }
    if (files.length > 4) {
      return NextResponse.json(
        { ok: false, error: "MVP хувилбарт нэг удаа 4 хүртэл файл харьцуулна." },
        { status: 400 },
      );
    }
    if (sourceCount > 6) {
      return NextResponse.json(
        { ok: false, error: "Нэг удаа нийт 6 хүртэл баримт харьцуулна." },
        { status: 400 },
      );
    }

    const config = await readAiScopeConfig();
    const scope = resolveAiDataScope(access.profile, access.roleId, config);
    if (policyIds.length > 0 && !scope.sources.includes("policy_content")) {
      return NextResponse.json(
        { ok: false, error: "Журмын агуулгын AI мэдээллийн эх үүсвэр хаалттай байна." },
        { status: 403 },
      );
    }

    const uploadedDocuments = await Promise.all(
      files.map((file, index) => extractUploadedDocument(file, index)),
    );
    const stored = policyIds.length
      ? await loadStoredPoliciesForComparison(policyIds, scope)
      : { documents: [], chunks: [] };
    const documents = [...stored.documents, ...uploadedDocuments];
    const chunks = [...stored.chunks, ...uploadedDocuments.flatMap(chunkDocument)];
    const emptyDocument = documents.find(
      (document) => !chunks.some((chunk) => chunk.documentId === document.id),
    );
    if (emptyDocument) {
      return NextResponse.json(
        {
          ok: false,
          error: `${emptyDocument.name}: харьцуулах хэсэг үүсгэж чадсангүй.`,
        },
        { status: 400 },
      );
    }

    const result = await comparePolicyDocuments(documents, chunks, focus);
    await registerPolicyReviewSession(access.user.id, result, chunks);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Баримт харьцуулахад алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
