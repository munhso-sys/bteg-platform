import {
  cleanJobDescriptionText,
  mergeParsedIntoDraft,
  parseJobDescriptionHtml,
  parseJobDescriptionJson,
  parseJobDescriptionText,
  type ParsedJobDescriptionFields,
} from "./parse-core";

export type { ParsedJobDescriptionFields };
export {
  mergeParsedIntoDraft,
  parseJobDescriptionHtml,
  parseJobDescriptionText,
} from "./parse-core";

export type ParseUploadedResult = {
  fields: ParsedJobDescriptionFields;
  warnings: string[];
  characterCount: number;
  fileName: string;
};

const MAX_FILE_BYTES = 12 * 1024 * 1024;

function countFilled(fields: ParsedJobDescriptionFields) {
  return Object.entries(fields).filter(([, v]) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return cleanJobDescriptionText(result.text ?? "");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function parseUploadedJobDescriptionFile(
  file: File,
): Promise<ParseUploadedResult> {
  if (file.size <= 0) throw new Error("Хоосон файл байна.");
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Файл 12 MB-аас их байна.");
  }

  const fileName = file.name || "document";
  const lower = fileName.toLowerCase();
  const warnings: string[] = [];
  const buffer = Buffer.from(await file.arrayBuffer());

  let fields: ParsedJobDescriptionFields;

  if (lower.endsWith(".json") || file.type === "application/json") {
    fields = parseJobDescriptionJson(buffer.toString("utf8"));
  } else if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    const text = await extractPdfText(buffer);
    if (text.length < 40) {
      throw new Error("PDF-ээс хангалттай текст задалж чадсангүй.");
    }
    fields = parseJobDescriptionText(text);
  } else if (
    lower.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const [htmlResult, textResult] = await Promise.all([
      mammoth.convertToHtml({ buffer }),
      mammoth.extractRawText({ buffer }),
    ]);
    const htmlFields = parseJobDescriptionHtml(htmlResult.value ?? "");
    const textFields = parseJobDescriptionText(textResult.value ?? "");
    // HTML table parse wins; text fills remaining gaps.
    fields = mergeParsedIntoDraft(textFields, htmlFields);
    if ((fields.markdown_body ?? "").length < 40) {
      throw new Error("DOCX-ээс хангалттай текст задалж чадсангүй.");
    }
  } else if (lower.endsWith(".doc") || file.type === "application/msword") {
    throw new Error(
      "Хуучин .doc формат дэмжихгүй. .docx, PDF, MD, TXT эсвэл JSON ашиглана уу.",
    );
  } else if (
    lower.endsWith(".md") ||
    lower.endsWith(".txt") ||
    file.type.startsWith("text/")
  ) {
    const raw = buffer.toString("utf8");
    fields = raw.trimStart().startsWith("<")
      ? parseJobDescriptionHtml(raw)
      : parseJobDescriptionText(raw);
  } else {
    throw new Error("Зөвхөн PDF, DOCX, MD, TXT, JSON файл дэмжинэ.");
  }

  const filled = countFilled(fields);
  if (filled <= 1 && !fields.markdown_body) {
    throw new Error("Файлаас АБТ талбар олдсонгүй.");
  }
  if (filled <= 4) {
    warnings.push(
      "Цөөн талбар танигдлаа — зарим нүдийг гараар шалгаарай.",
    );
  }

  return {
    fields,
    warnings,
    characterCount: (fields.markdown_body ?? "").length,
    fileName,
  };
}
