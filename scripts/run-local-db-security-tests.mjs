/**
 * Local-only runner: loads keys from `supabase status -o json` (never prints them)
 * and executes P0-03 + optional research RLS tests against 127.0.0.1.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inspectMn = path.join(root, "inspect-mn");
const development = path.join(root, "development");

function loadLocalSupabaseEnv() {
  const outFile = path.join(inspectMn, ".supabase-status.local.json");
  const r = spawnSync(
    "npx",
    ["--yes", "supabase", "status", "-o", "json"],
    {
      cwd: inspectMn,
      encoding: "utf8",
      shell: true,
      // Keep npm notices off stdout so JSON parse stays clean.
      env: { ...process.env, npm_config_loglevel: "error" },
    },
  );
  if (r.status !== 0) {
    console.error("supabase status failed");
    if (r.stderr) console.error(r.stderr.slice(0, 500));
    process.exit(1);
  }
  const combined = `${r.stdout || ""}\n${r.stderr || ""}`;
  const match = combined.match(/\{[\s\S]*"API_URL"[\s\S]*\}/);
  if (!match) {
    console.error("no status JSON with API_URL found");
    process.exit(1);
  }
  const obj = JSON.parse(match[0]);
  // Do not persist secrets to disk; parse in-memory only.
  void outFile;
  const url = String(obj.API_URL || "");
  if (!url.includes("127.0.0.1") && !url.includes("localhost")) {
    console.error("refusing non-local API_URL");
    process.exit(1);
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = String(obj.ANON_KEY || "");
  process.env.SUPABASE_SERVICE_ROLE_KEY = String(obj.SERVICE_ROLE_KEY || "");
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error("missing local anon/service keys from status");
    process.exit(1);
  }
  console.log("LOCAL_READY=true");
}

function run(cwd, args) {
  const r = spawnSync("npx", args, {
    cwd,
    env: process.env,
    encoding: "utf8",
    shell: true,
    stdio: "inherit",
  });
  return r.status ?? 1;
}

loadLocalSupabaseEnv();

const p003 = run(inspectMn, [
  "tsx",
  "--test",
  "src/lib/org-app-data-store.p0-03.test.ts",
]);
console.log(`EXIT_P003=${p003}`);

const research = run(development, [
  "tsx",
  "--test",
  "src/lib/rd-storage.test.ts",
  "src/lib/research/rls.test.ts",
]);
console.log(`EXIT_RESEARCH=${research}`);

process.exit(p003 === 0 && research === 0 ? 0 : 1);
