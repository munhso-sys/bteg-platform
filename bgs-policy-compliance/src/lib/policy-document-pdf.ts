import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  clauseHeading,
  POLICY_PAGE_MARGINS,
  sectionHeading,
  type PolicyDocumentModel,
} from "@/lib/policy-document";
import type { ClauseTreeNode } from "@/lib/types";

type PdfMakeApi = {
  vfs: Record<string, string>;
  createPdf: (
    doc: TDocumentDefinitions,
  ) => {
    getBuffer: (cb: (result: Buffer) => void) => void;
  };
};

const pdf = pdfMake as unknown as PdfMakeApi;
pdf.vfs = pdfFonts as unknown as Record<string, string>;

function cmToPt(cm: number) {
  return cm * 28.3465;
}

function getPdfBuffer(doc: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      pdf.createPdf(doc).getBuffer((result) => {
        resolve(Buffer.from(result));
      });
    } catch (error) {
      reject(error);
    }
  });
}

function walkClauses(
  nodes: ClauseTreeNode[],
  depth: number,
  out: Content[],
) {
  for (const node of nodes) {
    out.push({
      text: [
        { text: `${clauseHeading(node)}. `, bold: true },
        { text: node.text || "" },
      ],
      fontSize: 11,
      alignment: "justify",
      margin: [depth * 12, 0, 0, 8],
    });
    if (node.children?.length) {
      walkClauses(node.children, depth + 1, out);
    }
  }
}

/** Formal linear PDF (no collapse) for email / Telegram attachments. */
export async function renderFormalPolicyPdf(
  model: PolicyDocumentModel,
): Promise<Buffer> {
  const { policy, sections } = model;
  const content: Content[] = [];

  if (policy.reference_code) {
    content.push({
      text: `Код: ${policy.reference_code}`,
      alignment: "center",
      fontSize: 10,
      margin: [0, 0, 0, 4],
    });
  }

  content.push({
    text: policy.name,
    style: "title",
    alignment: "center",
    margin: [0, 0, 0, 8],
  });

  const meta: string[] = [];
  if (policy.version != null) meta.push(`Хувилбар: ${policy.version}`);
  if (policy.approved_date) meta.push(`Батлагдсан: ${policy.approved_date}`);
  if (meta.length) {
    content.push({
      text: meta.join(" · "),
      alignment: "center",
      fontSize: 10,
      margin: [0, 0, 0, 16],
    });
  }

  for (const block of sections) {
    content.push({
      text: sectionHeading(block.section),
      style: "section",
      alignment: "center",
      margin: [0, 12, 0, 8],
    });
    walkClauses(block.clauses, 0, content);
  }

  const m = POLICY_PAGE_MARGINS;
  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    // pdfmake: [left, top, right, bottom]
    pageMargins: [
      cmToPt(m.leftCm),
      cmToPt(m.topCm),
      cmToPt(m.rightCm),
      cmToPt(m.bottomCm),
    ],
    content,
    defaultStyle: {
      font: "Roboto",
      fontSize: 11,
    },
    styles: {
      title: { fontSize: 14, bold: true },
      section: { fontSize: 12, bold: true },
    },
  };

  return getPdfBuffer(doc);
}
