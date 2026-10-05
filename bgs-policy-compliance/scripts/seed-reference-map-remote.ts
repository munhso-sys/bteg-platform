/**
 * One-shot: upload local reference-map.json to app_data_store so Portal
 * Policy Review can classify policies the same way as the Policy module.
 *
 * Usage (from bgs-policy-compliance, with Supabase env loaded):
 *   npx tsx scripts/seed-reference-map-remote.ts
 */
import { promises as fs, readFileSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.join(process.cwd());
const MAP_PATH = path.join(ROOT, "data", "local", "reference-map.json");
const KEY = "policy_compliance_reference_map";

function loadEnvFile(file: string) {
  try {
    const raw = readFileSync(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    // optional
  }
}

async function main() {
  loadEnvFile(path.join(ROOT, ".env.local"));
  loadEnvFile(path.join(ROOT, ".env"));
  loadEnvFile(path.join(ROOT, "../inspect-mn/.env.local"));

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) {
    throw new Error("SUPABASE URL + SERVICE_ROLE_KEY required");
  }

  const map = JSON.parse(await fs.readFile(MAP_PATH, "utf8")) as {
    policy_to_org?: Record<string, unknown>;
  };
  const count = Object.keys(map.policy_to_org ?? {}).length;
  if (count === 0) throw new Error("Local reference-map has no policy_to_org");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from("app_data_store").upsert(
    {
      key: KEY,
      payload: map,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  console.log(`OK: upserted ${KEY} with ${count} policy_to_org entries`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
