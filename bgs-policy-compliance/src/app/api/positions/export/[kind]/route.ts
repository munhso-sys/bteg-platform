import { NextResponse } from "next/server";
import { getPositionDetail } from "@/lib/db/repository";
import { listPositionsForReview } from "@/lib/db/org";
import {
  buildPositionPreviewWordBuffer,
  positionPreviewAttachmentDisposition,
  renderPositionPreviewHtml,
} from "@/lib/position-preview-document";
import { renderPositionPreviewPdf } from "@/lib/position-preview-document-pdf";
import { buildPositionPreviewExportModel } from "@/lib/position-preview-export";
import {
  buildPositionReviewWordBuffer,
  filterPositionReviewRows,
  positionReviewAttachmentDisposition,
  renderPositionReviewHtml,
  type PositionReviewScope,
} from "@/lib/position-review-document";
import { renderPositionReviewPdf } from "@/lib/position-review-document-pdf";
import {
  attachmentContentDisposition,
  policyPageCssMargin,
  utf8Filename,
} from "@/lib/policy-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseScope(url: URL): PositionReviewScope {
  return {
    organization: url.searchParams.get("org") ?? undefined,
    heltesId: url.searchParams.get("heltesId") ?? undefined,
    albaId: url.searchParams.get("albaId") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  try {
    const { kind } = await params;
    if (kind !== "word" && kind !== "pdf") {
      return NextResponse.json({ error: "Буруу төрөл" }, { status: 400 });
    }

    const url = new URL(req.url);
    const positionId = url.searchParams.get("positionId")?.trim() || null;

    // Preview detail screen → formal single-position document
    if (positionId) {
      const detail = await getPositionDetail(positionId);
      if (!detail) {
        return NextResponse.json(
          { error: "Ажлын байр олдсонгүй" },
          { status: 404 },
        );
      }
      const reviewRows = await listPositionsForReview();
      const reviewRow =
        reviewRows.find((r) => r.id === detail.position.id) ?? null;
      const model = buildPositionPreviewExportModel(detail, reviewRow);

      if (kind === "word") {
        const bytes = buildPositionPreviewWordBuffer(model);
        return new NextResponse(new Uint8Array(bytes), {
          status: 200,
          headers: {
            "Content-Type": "application/msword; charset=utf-8",
            "Content-Disposition":
              positionPreviewAttachmentDisposition(model),
            "Cache-Control": "no-store",
          },
        });
      }

      // Prefer real PDF bytes for share/download consistency; browser print
      // path still uses HTML below when Accept prefers HTML — client uses print.
      const wantsHtml =
        (url.searchParams.get("print") ?? "1") !== "0" &&
        !(url.searchParams.get("binary") === "1");

      if (wantsHtml) {
        const margin = policyPageCssMargin();
        const html = renderPositionPreviewHtml(model).replace(
          "</head>",
          `<style>
@page { size: A4; margin: ${margin}; }
@media print { html, body { margin: 0 !important; } }
</style>
</head>`,
        );
        return new NextResponse(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }

      const pdfBytes = await renderPositionPreviewPdf(model);
      return new NextResponse(new Uint8Array(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": attachmentContentDisposition(
            utf8Filename(
              `${model.position.name} — шалгалт`.slice(0, 80),
              "pdf",
            ),
          ),
          "Cache-Control": "no-store",
        },
      });
    }

    // List screen → formal hierarchical table of currently filtered scope
    const scope = parseScope(url);
    const all = await listPositionsForReview(scope.q);
    const rows = filterPositionReviewRows(all, scope);

    if (kind === "word") {
      const bytes = buildPositionReviewWordBuffer(rows, scope);
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/msword; charset=utf-8",
          "Content-Disposition": positionReviewAttachmentDisposition(scope),
          "Cache-Control": "no-store",
        },
      });
    }

    const margin = policyPageCssMargin();
    const html = renderPositionReviewHtml(rows, scope).replace(
      "</head>",
      `<style>
@page { size: A4 landscape; margin: ${margin}; }
@media print { html, body { margin: 0 !important; } }
</style>
</head>`,
    );

    return new NextResponse(html, {
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
