import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chunkDocument } from "../src/lib/policy-review/chunk";
import { comparePolicyDocuments } from "../src/lib/policy-review/compare";
import type {
  ExtractedDocument,
  ReviewFindingType,
} from "../src/lib/policy-review/types";

async function sample(name: string, id: string): Promise<ExtractedDocument> {
  const text = await readFile(
    resolve(process.cwd(), "samples", "policy-review", name),
    "utf8",
  );
  return {
    id,
    name,
    mimeType: "text/plain",
    pages: [{ page: null, text }],
    characterCount: text.length,
    warnings: [],
  };
}

async function main() {
  const documents = await Promise.all([
    sample("procedure-a.txt", "doc-a"),
    sample("procedure-b.txt", "doc-b"),
  ]);
  const chunks = documents.flatMap(chunkDocument);
  const result = await comparePolicyDocuments(documents, chunks);

  const requiredTypes = new Set<ReviewFindingType>([
    "contradiction",
    "conflict",
    "duplicate",
  ]);
  const foundTypes = new Set(result.findings.map((finding) => finding.type));
  const missingTypes = [...requiredTypes].filter((type) => !foundTypes.has(type));
  const badCitation = result.findings
    .flatMap((finding) => finding.citations)
    .find((citation) => !citation.supported || citation.quote.length < 12);

  if (missingTypes.length > 0) {
    throw new Error(`Expected finding types missing: ${missingTypes.join(", ")}`);
  }
  if (badCitation) {
    throw new Error(`Unsupported citation returned: ${badCitation.chunkId}`);
  }

  console.log(
    JSON.stringify(
      {
        mode: result.mode,
        documents: result.documents,
        stats: result.stats,
        findings: result.findings.map((finding) => ({
          type: finding.type,
          title: finding.title,
          supported: finding.supported,
          citations: finding.citations.map((citation) => ({
            document: citation.documentName,
            page: citation.page,
            section: citation.section,
            quote: citation.quote,
          })),
        })),
      },
      null,
      2,
    ),
  );
}

void main();
