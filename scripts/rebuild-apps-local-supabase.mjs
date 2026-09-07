/**
 * Rebuild deployable apps with local Supabase public env (from supabase status).
 * Does not print secrets.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inspectMn = path.join(root, "inspect-mn");

function loadLocalStatus() {
  const r = spawnSync("npx", ["--yes", "supabase", "status", "-o", "json"], {
    cwd: inspectMn,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, npm_config_loglevel: "error" },
  });
  const combined = `${r.stdout || ""}\n${r.stderr || ""}`;
  const match = combined.match(/\{[\s\S]*"API_URL"[\s\S]*\}/);
  if (!match) throw new Error("supabase status JSON missing");
  const obj = JSON.parse(match[0]);
  const url = String(obj.API_URL || "");
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    throw new Error("refusing non-local supabase");
  }
  return {
    url,
    anon: String(obj.ANON_KEY || ""),
    service: String(obj.SERVICE_ROLE_KEY || ""),
    publishable: String(obj.PUBLISHABLE_KEY || ""),
  };
}

const status = loadLocalStatus();
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: status.url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.anon,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.publishable || status.anon,
  SUPABASE_SERVICE_ROLE_KEY: status.service,
  POLICY_EMBED_SECRET: "e2e-local-embed-secret-preview-gate",
  INSPECTION_EMBED_SECRET: "e2e-local-embed-secret-preview-gate",
};

const apps = [
  path.join(root, "inspect-mn"),
  path.join(root, "inspection-center"),
  path.join(root, "bgs-policy-compliance"),
  path.join(root, "development"),
];

let failed = false;
for (const cwd of apps) {
  console.log(`BUILD ${path.basename(cwd)}`);
  const r = spawnSync("npm", ["run", "build"], {
    cwd,
    env,
    shell: true,
    encoding: "utf8",
  });
  process.stdout.write((r.stdout || "").slice(-2000));
  if (r.status !== 0) {
    process.stderr.write((r.stderr || "").slice(-2000));
    console.log(`FAIL ${path.basename(cwd)}`);
    failed = true;
    break;
  }
  console.log(`OK ${path.basename(cwd)}`);
}
process.exit(failed ? 1 : 0);
