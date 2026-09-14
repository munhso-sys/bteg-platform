/**
 * Import ASCII-aliased samples from data/samples into the store as uploads
 * attached to the L3 loading process (or first node).
 *
 * Usage: npx tsx scripts/import-samples.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { newId, nowIso } from "../src/lib/cn";
import {
  bumpVersion,
  checksum,
  detectFileType,
  detectMime,
  inferModuleCategory,
  saveUploadBuffer,
} from "../src/lib/files/storage";
import { refineXmlType } from "../src/lib/files/detect";
import { parseDrawioXml } from "../src/lib/parse/drawio";
import {
  materializeMatrixRows,
  parseExcelBuffer,
} from "../src/lib/parse/excel";
import { addProcessFile, loadDb } from "../src/lib/store";
import type { ProcessFile, ProcessMatrixDocument } from "../src/lib/types";

const SAMPLES = [
  "Uurkhain_processyn_zuraglal-Mehanik.xlsx",
  "7_HMMZA-process-Batjargal/3_HMM_tolovlogoot_zasvar_hiikh-3.drawio",
  "7_HMMZA-process-Batjargal/HMMZA_ajlyn_jagdaalt_suuld_2.xlsx",
  "Uildverleliin_heltes-Process_zuraglal_4755.pdf",
  "Uurkhain_schem_1_3.pdf",
];

async function main() {
  const db = await loadDb();
  const processId =
    db.nodes.find((n) => n.code === "ACT-MINE-01")?.id ||
    db.nodes.find((n) => n.level === "L3_ACTIVITY")?.id ||
    db.nodes[0]?.id;
  if (!processId) throw new Error("No process nodes — start app once to seed");

  const root = path.join(process.cwd(), "data", "samples");

  for (const rel of SAMPLES) {
    const abs = path.join(root, rel);
    try {
      await fs.access(abs);
    } catch {
      console.warn("SKIP missing", rel);
      continue;
    }
    const buf = await fs.readFile(abs);
    const originalName = path.basename(rel);
    let fileType = detectFileType(originalName);
    if (fileType === "xml" || fileType === "drawio" || fileType === "bpmn") {
      fileType = refineXmlType(fileType, buf.toString("utf8"));
    }
    const fileId = newId("file");
    const { relativePath } = await saveUploadBuffer(
      processId,
      fileId,
      originalName,
      buf,
    );

    let diagram_node_ids: string[] = [];
    let parsed_matrix_id: string | null = null;
    let matrixRows;
    let matrixDoc: ProcessMatrixDocument | undefined;

    if (fileType === "drawio") {
      diagram_node_ids = parseDrawioXml(buf.toString("utf8")).taskIds;
    }
    if (fileType === "xlsx") {
      const parsed = parseExcelBuffer(buf, originalName);
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

    const existing = (await loadDb()).files.find(
      (f) =>
        f.process_id === processId &&
        f.file_type === fileType &&
        f.is_current,
    );

    const record: ProcessFile = {
      id: fileId,
      process_id: processId,
      file_name: path.basename(relativePath),
      original_name: originalName,
      file_type: fileType,
      mime_type: detectMime(fileType),
      file_path: relativePath,
      size_bytes: buf.length,
      version: bumpVersion(existing?.version),
      previous_file_id: existing?.id ?? null,
      is_current: true,
      process_owner: "PFD sample import",
      module_category: inferModuleCategory(fileType),
      parsed_matrix_id,
      diagram_node_ids,
      checksum: checksum(buf),
      uploaded_by: "import-samples",
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    await addProcessFile(record, matrixRows, matrixDoc);
    console.log(
      "OK",
      originalName,
      fileType,
      `v${record.version}`,
      matrixRows ? `${matrixRows.length} rows` : "",
      diagram_node_ids.length ? `${diagram_node_ids.length} shapes` : "",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
