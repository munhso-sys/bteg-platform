/**
 * READ-ONLY pull of policy app_data_store keys into data/local/.
 * Does not write to Supabase. Requires .env.local with URL + service role.
 *
 * Keys:
 *   policy_compliance_db → data/local/db.json
 *   policy_compliance_position_org_overrides
 *   policy_compliance_policy_org_overrides
 *   policy_compliance_org_catalog_overrides
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gunzipSync } from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");

function loadEnvLocal(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function isGzipEnvelope(value) {
  return (
    !!value &&
    typeof value === "object" &&
    value.__encoding === "gzip-base64" &&
    typeof value.data === "string"
  );
}

function decodePayload(payload) {
  if (payload == null) return null;
  if (isGzipEnvelope(payload)) {
    const json = gunzipSync(Buffer.from(payload.data, "base64")).toString(
      "utf8",
    );
    return JSON.parse(json);
  }
  return payload;
}

const KEYS = [
  {
    key: "policy_compliance_db",
    file: path.join(root, "data", "local", "db.json"),
  },
  {
    key: "policy_compliance_position_org_overrides",
    file: path.join(
      root,
      "data",
      "local",
      "position-org-overrides.json",
    ),
  },
  {
    key: "policy_compliance_policy_org_overrides",
    file: path.join(root, "data", "local", "policy-org-overrides.json"),
  },
  {
    key: "policy_compliance_org_catalog_overrides",
    file: path.join(root, "data", "local", "org-catalog-overrides.json"),
  },
];

async function main() {
  // Prefer app .env.local; fall back to inspect-mn (shared platform Supabase).
  const env = {
    ...loadEnvLocal(path.join(root, "..", "inspect-mn", ".env.local")),
    ...loadEnvLocal(envPath),
  };
  const url =
    env.SUPABASE_URL ||
    env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.log(
      "SKIP: missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY",
    );
    console.log(
      `  url=${url ? "present" : "missing"} serviceRole=${serviceKey ? "present" : "missing"}`,
    );
    console.log(
      "  Put keys in bgs-policy-compliance/.env.local or inspect-mn/.env.local",
    );
    process.exitCode = 1;
    return;
  }

  const base = url.replace(/\/$/, "");
  const results = [];

  for (const { key, file } of KEYS) {
    const endpoint = `${base}/rest/v1/app_data_store?key=eq.${encodeURIComponent(key)}&select=payload,updated_at`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      results.push({ key, ok: false, status: res.status, error: text.slice(0, 200) });
      continue;
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length || rows[0].payload == null) {
      results.push({ key, ok: false, status: 200, error: "empty/missing row" });
      continue;
    }
    let decoded;
    try {
      decoded = decodePayload(rows[0].payload);
    } catch (err) {
      results.push({
        key,
        ok: false,
        status: 200,
        error: `decode failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(decoded, null, 2)}\n`, "utf8");
    const bytes = fs.statSync(file).size;
    results.push({
      key,
      ok: true,
      file: path.relative(root, file).replace(/\\/g, "/"),
      bytes,
      updated_at: rows[0].updated_at ?? null,
    });
  }

  for (const r of results) {
    if (r.ok) {
      console.log(`OK ${r.key} → ${r.file} (${r.bytes} bytes) updated_at=${r.updated_at}`);
    } else {
      console.log(`FAIL ${r.key}: ${r.error || r.status}`);
    }
  }
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
