import type { ExtractedDocument, ReviewChunk } from "./types";

const MAX_CHUNK_CHARS = 1100;
const OVERLAP_CHARS = 140;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isHeading(line: string) {
  const value = line.trim();
  if (!value || value.length > 140) return false;
  return (
    /^\d+(?:\.\d+){0,5}[.)]?\s+\S+/.test(value) ||
    /^(бүлэг|хэсэг|section|chapter)\s+/i.test(value) ||
    (value.length <= 80 && value === value.toUpperCase() && /\p{L}/u.test(value))
  );
}

function splitLongText(value: string) {
  const text = clean(value);
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const out: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + MAX_CHUNK_CHARS, text.length);
    if (end < text.length) {
      const sentenceEnd = Math.max(
        text.lastIndexOf(". ", end),
        text.lastIndexOf("; ", end),
        text.lastIndexOf("\n", end),
      );
      if (sentenceEnd > start + 420) end = sentenceEnd + 1;
    }
    out.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }
  return out.filter((item) => item.length >= 30);
}

export function chunkDocument(document: ExtractedDocument): ReviewChunk[] {
  const chunks: ReviewChunk[] = [];
  let section: string | null = null;
  let index = 0;

  for (const page of document.pages) {
    const blocks = page.text.split(/\n\s*\n|(?=^\d+(?:\.\d+){0,5}[.)]?\s+)/gm);
    for (const rawBlock of blocks) {
      const lines = rawBlock.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) continue;
      if (isHeading(lines[0])) section = clean(lines[0]);
      const text = clean(lines.join(" "));
      for (const part of splitLongText(text)) {
        index += 1;
        chunks.push({
          id: `${document.id}-chunk-${index}`,
          documentId: document.id,
          documentName: document.name,
          index,
          page: page.page,
          section,
          text: part,
        });
      }
    }
  }

  return chunks.slice(0, 180);
}

