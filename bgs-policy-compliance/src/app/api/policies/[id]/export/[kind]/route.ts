import { NextResponse } from "next/server";
import { getPolicyDetail } from "@/lib/db/repository";
import {
  asciiFilename,
  attachmentContentDisposition,
  buildPolicyDocumentModel,
  buildWordBuffer,
  policyPageCssMargin,
  renderFormalPolicyHtml,
  utf8Filename,
} from "@/lib/policy-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  try {
    const { id, kind } = await params;
    if (kind !== "word" && kind !== "pdf") {
      return NextResponse.json({ error: "Буруу төрөл" }, { status: 400 });
    }

    const detail = await getPolicyDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Журам олдсонгүй" }, { status: 404 });
    }

    const model = buildPolicyDocumentModel(detail);
    const html = renderFormalPolicyHtml(model);

    if (kind === "word") {
      const filename = utf8Filename(detail.policy.name, "doc");
      const ascii = asciiFilename(
        detail.policy.reference_code?.trim() ||
          `policy-${detail.policy.id.slice(0, 8)}`,
        "doc",
      );
      const bytes = buildWordBuffer(html);
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/msword; charset=utf-8",
          "Content-Disposition": attachmentContentDisposition(filename, ascii),
          "Cache-Control": "no-store",
          "Access-Control-Expose-Headers": "Content-Disposition",
        },
      });
    }

    // Formal PDF path: print-ready HTML (no collapse). Client opens print → Save as PDF.
    const margin = policyPageCssMargin();
    const printHtml = html.replace(
      "</head>",
      `<style>
@page {
  size: A4;
  margin: ${margin};
}
@media print {
  html, body { margin: 0 !important; }
}
</style>
</head>`,
    );

    return new NextResponse(printHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Экспорт үүсгэхэд алдаа гарлаа",
      },
      { status: 500 },
    );
  }
}
