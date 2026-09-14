import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { ProcessFileType, ProcessModuleCategory } from "@/lib/types";
import {
  downloadProcessObject,
  preferObjectStorage,
  uploadProcessObject,
} from "@/lib/files/object-storage";

export const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

const EXT_MAP: Record<string, ProcessFileType> = {
  ".bpmn": "bpmn",
  ".drawio": "drawio",
  ".xml": "xml",
  ".pdf": "pdf",
  ".xlsx": "xlsx",
  ".xls": "xlsx",
  ".csv": "csv",
};

export function detectFileType(fileName: string): ProcessFileType {
  const ext = path.extname(fileName).toLowerCase();
  return EXT_MAP[ext] ?? "other";
}

export function detectMime(fileType: ProcessFileType): string {
  switch (fileType) {
    case "bpmn":
    case "drawio":
    case "xml":
      return "application/xml";
    case "pdf":
      return "application/pdf";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "csv":
      return "text/csv";
    default:
      return "application/octet-stream";
  }
}

export function inferModuleCategory(
  fileType: ProcessFileType,
): ProcessModuleCategory {
  switch (fileType) {
    case "bpmn":
      return "BPMN";
    case "drawio":
      return "PFD";
    case "xlsx":
    case "csv":
      return "MATRIX";
    case "pdf":
      return "DOCUMENT";
    default:
      return "OTHER";
  }
}

export function checksum(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 32);
}

export function bumpVersion(current: string | null | undefined): string {
  if (!current) return "1.0";
  const m = /^(\d+)\.(\d+)$/.exec(current.trim());
  if (!m) return "1.0";
  return `${m[1]}.${Number(m[2]) + 1}`;
}

export async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export async function saveUploadBuffer(
  processId: string,
  fileId: string,
  originalName: string,
  buf: Buffer,
  contentType?: string,
): Promise<{ relativePath: string; absolutePath: string }> {
  const safeExt = path.extname(originalName).toLowerCase() || ".bin";
  const fileName = `${fileId}${safeExt}`;

  if (preferObjectStorage()) {
    const remotePath = await uploadProcessObject(
      processId,
      fileName,
      buf,
      contentType || "application/octet-stream",
    );
    return { relativePath: remotePath, absolutePath: remotePath };
  }

  await ensureUploadsDir();
  const dir = path.join(UPLOADS_DIR, processId);
  await fs.mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, fileName);
  await fs.writeFile(absolutePath, buf);
  const relativePath = path
    .join("uploads", processId, fileName)
    .replace(/\\/g, "/");
  return { relativePath, absolutePath };
}

export function resolveUploadPath(relativePath: string): string {
  if (relativePath.startsWith("supabase:")) {
    throw new Error("Remote path cannot resolve to local FS");
  }
  const cleaned = relativePath.replace(/^[/\\]+/, "");
  if (cleaned.includes("..")) {
    throw new Error("Invalid file path");
  }
  return path.join(process.cwd(), "data", cleaned);
}

export async function readUploadBuffer(relativePath: string): Promise<Buffer> {
  if (relativePath.startsWith("supabase:")) {
    return downloadProcessObject(relativePath);
  }
  return fs.readFile(resolveUploadPath(relativePath));
}

export async function readUploadText(relativePath: string): Promise<string> {
  const buf = await readUploadBuffer(relativePath);
  return buf.toString("utf8");
}
