import type { ClauseTreeNode, Policy, PolicySection } from "@/lib/types";

export type PolicyDocumentSection = {
  section: PolicySection;
  clauses: ClauseTreeNode[];
};

export type PolicyDocumentModel = {
  policy: Policy;
  sections: PolicyDocumentSection[];
};

/** Print / Word page box: top & bottom 2cm, left 2.5cm, right 1cm. */
export const POLICY_PAGE_MARGINS = {
  topCm: 2,
  rightCm: 1,
  bottomCm: 2,
  leftCm: 2.5,
} as const;

export function policyPageCssMargin(): string {
  const m = POLICY_PAGE_MARGINS;
  return `${m.topCm}cm ${m.rightCm}cm ${m.bottomCm}cm ${m.leftCm}cm`;
}

/** Nested tree kept for preview collapse; flat list for formal export. */
export function buildPolicyDocumentModel(detail: {
  policy: Policy;
  trees: Array<{ section: PolicySection; tree: ClauseTreeNode[] }>;
}): PolicyDocumentModel {
  return {
    policy: detail.policy,
    sections: detail.trees.map(({ section, tree }) => ({
      section,
      clauses: tree,
    })),
  };
}

export function flattenDocumentClauses(
  sections: PolicyDocumentSection[],
): Array<{ section: PolicySection; clause: ClauseTreeNode; depth: number }> {
  const rows: Array<{
    section: PolicySection;
    clause: ClauseTreeNode;
    depth: number;
  }> = [];
  function walk(
    section: PolicySection,
    nodes: ClauseTreeNode[],
    depth: number,
  ) {
    for (const n of nodes) {
      rows.push({ section, clause: n, depth });
      if (n.children?.length) walk(section, n.children, depth + 1);
    }
  }
  for (const s of sections) {
    walk(s.section, s.clauses, 0);
  }
  return rows;
}

export function sectionHeading(section: PolicySection): string {
  const ref = (section.reference_number ?? "").trim();
  const text = (section.text ?? "").trim();
  if (ref && text) return `${ref}. ${text}`;
  if (ref) return ref;
  if (text) return text;
  return "Хэсэг";
}

export function clauseHeading(clause: ClauseTreeNode): string {
  const ref = (clause.reference_number ?? "").trim();
  return ref || "—";
}

export function asciiFilename(name: string, ext: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 60);
  // Mongolian-only titles collapse to underscores — keep a readable fallback.
  if (!base || /^[_.\s-]+$/.test(base)) {
    return `policy.${ext}`;
  }
  return `${base}.${ext}`;
}

export function utf8Filename(name: string, ext: string): string {
  const base = name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${base || "policy"}.${ext}`;
}

/** Browser <a download> name — keeps Cyrillic so the saved file is recognizable. */
export function clientDownloadFilename(name: string, ext: string): string {
  return utf8Filename(name, ext);
}

/** Prefer RFC5987 filename*; fall back to filename= / provided default. */
export function parseContentDispositionFilename(
  header: string | null,
  fallback: string,
): string {
  if (!header) return fallback;
  const star = /filename\*\s*=\s*(?:UTF-8''|utf-8'')([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* ignore */
    }
  }
  const plain = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(header);
  const fromPlain = (plain?.[1] || plain?.[2] || "").trim();
  if (fromPlain && !/^[_.\s-]+$/.test(fromPlain.replace(/\.[^.]+$/, ""))) {
    return fromPlain;
  }
  return fallback;
}

/** Safe Content-Disposition (ASCII filename= + RFC5987 filename*). */
export function attachmentContentDisposition(
  utf8Name: string,
  asciiName?: string,
): string {
  const ext = utf8Name.includes(".")
    ? utf8Name.slice(utf8Name.lastIndexOf(".") + 1)
    : "bin";
  const stem = utf8Name.replace(/\.[^.]+$/, "");
  const ascii = asciiName || asciiFilename(stem, ext);
  // Prefer ASCII-only in filename="…" — non-ASCII ByteString throws → HTTP 500.
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`;
}

export function buildWordBuffer(html: string): Buffer {
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, Buffer.from(html, "utf8")]);
}

/**
 * Formal Word-compatible HTML (opens in Microsoft Word / LibreOffice).
 * No collapse — linear official document layout.
 */
export function renderFormalPolicyHtml(model: PolicyDocumentModel): string {
  const { policy, sections } = model;
  const title = escapeHtml(policy.name);
  const code = escapeHtml(policy.reference_code ?? "");
  const approved = escapeHtml(policy.approved_date ?? "");
  const version = escapeHtml(String(policy.version ?? ""));
  const pageMargin = policyPageCssMargin();

  const bodyParts: string[] = [];
  for (const block of sections) {
    bodyParts.push(
      `<h2 style="font-family:'Times New Roman',Times,serif;font-size:14pt;font-weight:bold;margin:18pt 0 8pt;text-align:center;text-transform:uppercase;">${escapeHtml(sectionHeading(block.section))}</h2>`,
    );
    function walk(nodes: ClauseTreeNode[], depth: number) {
      for (const c of nodes) {
        const pad = 18 + depth * 18;
        bodyParts.push(
          `<p style="font-family:'Times New Roman',Times,serif;font-size:12pt;margin:0 0 10pt;text-align:justify;text-indent:1.25cm;padding-left:${pad}pt;"><strong>${escapeHtml(clauseHeading(c))}.</strong> ${escapeHtml(c.text || "")}</p>`,
        );
        if (c.children?.length) walk(c.children, depth + 1);
      }
    }
    walk(block.clauses, 0);
  }

  return `<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page {
    size: A4;
    margin: ${pageMargin};
  }
  html, body {
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
  }
  @media print {
    html, body { margin: 0; }
  }
</style>
<!--[if gte mso 9]><xml>
<w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
</w:WordDocument>
</xml><![endif]-->
</head>
<body>
  <p style="font-family:'Times New Roman',Times,serif;font-size:11pt;text-align:center;margin:0 0 6pt;">${code ? `Код: ${code}` : ""}</p>
  <h1 style="font-family:'Times New Roman',Times,serif;font-size:16pt;font-weight:bold;text-align:center;margin:0 0 16pt;text-transform:uppercase;">${title}</h1>
  <p style="font-family:'Times New Roman',Times,serif;font-size:11pt;text-align:center;margin:0 0 20pt;">
    ${version ? `Хувилбар: ${version}` : ""}
    ${approved ? ` · Батлагдсан: ${approved}` : ""}
  </p>
  ${bodyParts.join("\n")}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
