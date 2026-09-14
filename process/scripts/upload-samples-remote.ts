/**
 * Upload local PFD samples to a running Process module (local or production).
 *
 * Usage:
 *   $env:PROCESS_URL="https://platform-process.vercel.app"
 *   npx tsx scripts/upload-samples-remote.ts
 */
import { promises as fs } from "fs";
import path from "path";

const BASE = (process.env.PROCESS_URL || "http://localhost:3004").replace(
  /\/$/,
  "",
);

const SAMPLES = [
  {
    rel: "Uurkhain_processyn_zuraglal-Mehanik.xlsx",
    owner: "Механик",
  },
  {
    rel: "7_HMMZA-process-Batjargal/3_HMM_tolovlogoot_zasvar_hiikh-3.drawio",
    owner: "ХММЗА",
  },
  {
    rel: "7_HMMZA-process-Batjargal/HMMZA_ajlyn_jagdaalt_suuld_2.xlsx",
    owner: "ХММЗА",
  },
  {
    rel: "Uildverleliin_heltes-Process_zuraglal_4755.pdf",
    owner: "Үйлдвэрлэл",
  },
  {
    rel: "Uurkhain_schem_1_3.pdf",
    owner: "Уурхай",
  },
];

async function main() {
  const listRes = await fetch(`${BASE}/api/v1/processes`);
  if (!listRes.ok) {
    throw new Error(`List processes failed: ${listRes.status} ${await listRes.text()}`);
  }
  const listJson = (await listRes.json()) as {
    data?: Array<{ id: string; code: string; level: string }>;
  };
  const nodes = listJson.data ?? [];
  const processId =
    nodes.find((n) => n.code === "ACT-MINE-01")?.id ||
    nodes.find((n) => n.level === "L3_ACTIVITY")?.id ||
    nodes[0]?.id;
  if (!processId) throw new Error("No process nodes on target");

  console.log("TARGET", BASE);
  console.log("PROCESS", processId);

  const root = path.join(process.cwd(), "data", "samples");
  for (const sample of SAMPLES) {
    const abs = path.join(root, sample.rel);
    const buf = await fs.readFile(abs);
    const blob = new Blob([buf]);
    const fd = new FormData();
    fd.set("file", blob, path.basename(sample.rel));
    fd.set("process_id", processId);
    fd.set("process_owner", sample.owner);
    fd.set("new_version", "1");

    const res = await fetch(`${BASE}/api/v1/processes/upload`, {
      method: "POST",
      body: fd,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("FAIL", sample.rel, res.status, text.slice(0, 400));
      continue;
    }
    console.log("OK", sample.rel, text.slice(0, 180));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
