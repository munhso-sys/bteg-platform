import { NextResponse } from "next/server";
import { newId, nowIso } from "@/lib/cn";
import { refineXmlType } from "@/lib/files/detect";
import {
  bumpVersion,
  checksum,
  detectFileType,
  detectMime,
  inferModuleCategory,
  saveUploadBuffer,
} from "@/lib/files/storage";
import { parseDrawioXml } from "@/lib/parse/drawio";
import {
  materializeMatrixRows,
  parseCsvBuffer,
  parseExcelBuffer,
} from "@/lib/parse/excel";
import { addProcessFile, getDb, listFiles } from "@/lib/store";
import type {
  ProcessFile,
  ProcessMatrixDocument,
  ProcessMatrixRow,
  ProcessModuleCategory,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = new Set([
  ".bpmn",
  ".drawio",
  ".xml",
  ".pdf",
  ".xlsx",
  ".xls",
  ".csv",
]);

/** POST /api/v1/processes/upload — multipart form upload */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form" }, { status: 400 });
  }

  const file = form.get("file");
  const processId = String(form.get("process_id") || "").trim();
  const owner = String(form.get("process_owner") || "").trim() || null;
  const categoryRaw = String(form.get("module_category") || "").trim();
  const versionAsNew = String(form.get("new_version") || "") === "1";

  if (!processId) {
    return NextResponse.json({ error: "process_id required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const originalName = file.name || "upload.bin";
  const ext = originalName.includes(".")
    ? `.${originalName.split(".").pop()!.toLowerCase()}`
    : "";
  if (!ALLOWED.has(ext)) {
    return NextResponse.json(
      {
        error: `Unsupported file type. Allowed: ${[...ALLOWED].join(", ")}`,
      },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > 40 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 40MB)" }, { status: 400 });
  }

  let fileType = detectFileType(originalName);
  if (fileType === "xml" || fileType === "bpmn" || fileType === "drawio") {
    fileType = refineXmlType(fileType, buf.toString("utf8"));
  }

  const db = await getDb();
  if (!db.nodes.some((n) => n.id === processId)) {
    return NextResponse.json({ error: "Process node not found" }, { status: 404 });
  }

  const existingCurrent = db.files.find(
    (f) =>
      f.process_id === processId &&
      f.file_type === fileType &&
      f.is_current,
  );
  const version = versionAsNew
    ? bumpVersion(existingCurrent?.version)
    : existingCurrent && !versionAsNew
      ? bumpVersion(existingCurrent.version)
      : "1.0";

  const fileId = newId("file");
  const { relativePath } = await saveUploadBuffer(
    processId,
    fileId,
    originalName,
    buf,
    file.type || detectMime(fileType),
  );

  let diagram_node_ids: string[] = [];
  let parsed_matrix_id: string | null = null;
  let matrixRows: ProcessMatrixRow[] | undefined;
  let matrixDoc: ProcessMatrixDocument | undefined;

  if (fileType === "drawio" || (fileType === "xml" && buf.includes("mxfile"))) {
    const parsed = parseDrawioXml(buf.toString("utf8"));
    diagram_node_ids = parsed.taskIds;
  }

  if (fileType === "xlsx" || fileType === "csv") {
    const parsed =
      fileType === "csv"
        ? parseCsvBuffer(buf, originalName)
        : parseExcelBuffer(buf, originalName);
    matrixRows = materializeMatrixRows(processId, fileId, parsed);
    parsed_matrix_id = newId("mdoc");
    matrixDoc = {
      id: parsed_matrix_id,
      process_id: processId,
      file_id: fileId,
      title: parsed.title,
      kind: parsed.kind,
      sheet_names: parsed.sheet_names,
      row_ids: matrixRows.map((r) => r.id),
      created_at: nowIso(),
    };
  }

  const module_category = (
    categoryRaw || inferModuleCategory(fileType)
  ) as ProcessModuleCategory;

  const record: ProcessFile = {
    id: fileId,
    process_id: processId,
    file_name: relativePath.split("/").pop() || originalName,
    original_name: originalName,
    file_type: fileType,
    mime_type: file.type || detectMime(fileType),
    file_path: relativePath,
    size_bytes: buf.length,
    version,
    previous_file_id: existingCurrent?.id ?? null,
    is_current: true,
    process_owner: owner,
    module_category,
    parsed_matrix_id,
    diagram_node_ids,
    checksum: checksum(buf),
    uploaded_by: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  await addProcessFile(record, matrixRows, matrixDoc);

  return NextResponse.json(
    {
      data: {
        file: record,
        matrix_rows_count: matrixRows?.length ?? 0,
        diagram_node_ids,
      },
    },
    { status: 201 },
  );
}

/** GET /api/v1/processes/upload?process_id= — list files (convenience) */
export async function GET(request: Request) {
  const processId = new URL(request.url).searchParams.get("process_id") || undefined;
  const files = await listFiles(processId || undefined);
  return NextResponse.json({ data: files });
}
