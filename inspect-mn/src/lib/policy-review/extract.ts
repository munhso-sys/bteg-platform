import "server-only";
import type { ExtractedDocument, ExtractedPage } from "./types";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const SUPPORTED_TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

function cleanText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function pagesFromMarkedText(text: string): ExtractedPage[] {
  const marker = /\[\[PAGE:(\d+)\]\]/g;
  const matches = [...text.matchAll(marker)];
  if (matches.length === 0) {
    const pages = text.split("\f").map(cleanText).filter(Boolean);
    return pages.map((pageText, index) => ({
      page: pages.length > 1 ? index + 1 : null,
      text: pageText,
    }));
  }

  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? text.length;
      return {
        page: Number(match[1]),
        text: cleanText(text.slice(start, end)),
      };
    })
    .filter((page) => page.text.length > 0);
}

function safeDocumentId(index: number, name: string) {
  const stem = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 32);
  return `doc-${index + 1}-${stem || "document"}`;
}

export async function extractUploadedDocument(
  file: File,
  index: number,
): Promise<ExtractedDocument> {
  if (file.size <= 0) throw new Error(`${file.name}: хоосон файл байна.`);
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name}: файл 8 MB-аас их байна.`);
  }

  const name = file.name || `document-${index + 1}`;
  const lowerName = name.toLowerCase();
  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const isText =
    SUPPORTED_TEXT_TYPES.has(file.type) ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md");

  let pages: ExtractedPage[] = [];
  const warnings: string[] = [];

  if (isPdf) {
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    let pageNumber = 0;
    const parsed = await pdfParse(Buffer.from(await file.arrayBuffer()), {
      pagerender: async (pageData) => {
        pageNumber += 1;
        const content = await pageData.getTextContent();
        const text = content.items
          .map((item) => item.str ?? "")
          .filter(Boolean)
          .join(" ");
        return `[[PAGE:${pageNumber}]]\n${text}`;
      },
    });
    pages = pagesFromMarkedText(parsed.text);
    if (pages.length === 0 && cleanText(parsed.text)) {
      pages = [{ page: null, text: cleanText(parsed.text) }];
      warnings.push(`${name}: PDF page metadata хадгалагдсангүй.`);
    }
  } else if (isText) {
    pages = pagesFromMarkedText(await file.text());
  } else {
    throw new Error(`${name}: зөвхөн PDF, TXT, MD файл дэмжинэ.`);
  }

  const characterCount = pages.reduce((sum, page) => sum + page.text.length, 0);
  if (characterCount < 40) {
    throw new Error(`${name}: харьцуулах хангалттай текст задалж чадсангүй.`);
  }

  return {
    id: safeDocumentId(index, name),
    name,
    mimeType: isPdf ? "application/pdf" : file.type || "text/plain",
    pages,
    characterCount,
    warnings,
  };
}

