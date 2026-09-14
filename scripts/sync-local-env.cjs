/**
 * LOCAL ONLY: sync portal public Supabase + embed secrets into duty module .env.local.
 * Does not print secret values. Does not call Vercel/GitHub/Production APIs.
 *
 * Usage: node scripts/sync-local-env.cjs
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function writeEnv(filePath, map, headerLines) {
  const keys = Object.keys(map);
  const body = keys.map((k) => `${k}=${map[k] ?? ""}`).join("\n");
  const header = headerLines.length ? headerLines.join("\n") + "\n\n" : "";
  fs.writeFileSync(filePath, header + body + "\n", "utf8");
}

function ensureSecret(map, key) {
  const v = (map[key] || "").trim();
  if (v) return v;
  const generated = crypto.randomBytes(32).toString("hex");
  map[key] = generated;
  return generated;
}

const portalPath = path.join(root, "inspect-mn", ".env.local");
const portal = parseEnv(portalPath);
if (!Object.keys(portal).length) {
  console.error("Missing inspect-mn/.env.local — copy from inspect-mn/.env.example first.");
  process.exit(1);
}

portal.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
portal.NEXT_PUBLIC_INSPECT_URL = portal.NEXT_PUBLIC_INSPECT_URL || "http://localhost:3001";
portal.NEXT_PUBLIC_POLICY_URL = portal.NEXT_PUBLIC_POLICY_URL || "http://localhost:3002";
portal.NEXT_PUBLIC_DEVELOPMENT_URL =
  portal.NEXT_PUBLIC_DEVELOPMENT_URL || "http://localhost:3003";
portal.NEXT_PUBLIC_PROCESS_URL =
  portal.NEXT_PUBLIC_PROCESS_URL || "http://localhost:3004";

const policySecret = ensureSecret(portal, "POLICY_EMBED_SECRET");
ensureSecret(portal, "INSPECTION_EMBED_SECRET");
if (!(portal.INSPECTION_EMBED_SECRET || "").trim()) {
  portal.INSPECTION_EMBED_SECRET = policySecret;
}

writeEnv(portalPath, portal, [
  "# Local portal env — managed by scripts/sync-local-env.cjs",
  "# SITE_URL forced to localhost for local auth redirects.",
]);

const publicKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
];

function pickPublic() {
  const o = {};
  for (const k of publicKeys) {
    if (portal[k]) o[k] = portal[k];
  }
  return o;
}

const icPath = path.join(root, "inspection-center", ".env.local");
const ic = { ...parseEnv(icPath), ...pickPublic() };
ic.INSPECTION_EMBED_SECRET = portal.INSPECTION_EMBED_SECRET;
ic.POLICY_EMBED_SECRET = portal.POLICY_EMBED_SECRET;
// Keep local FS store in next dev (default). Do not enable remote against Production.
delete ic.USE_REMOTE_STORE;
writeEnv(icPath, ic, ["# Local IC — synced from portal public + embed secrets"]);

const policyPath = path.join(root, "bgs-policy-compliance", ".env.local");
const policy = { ...parseEnv(policyPath), ...pickPublic() };
policy.POLICY_EMBED_SECRET = portal.POLICY_EMBED_SECRET;
delete policy.USE_REMOTE_STORE;
writeEnv(policyPath, policy, ["# Local Policy — synced from portal public + embed secrets"]);

const devPath = path.join(root, "development", ".env.local");
const development = { ...parseEnv(devPath), ...pickPublic() };
writeEnv(devPath, development, ["# Local Development — synced from portal public keys"]);

const processPath = path.join(root, "process", ".env.local");
const processEnv = { ...parseEnv(processPath), ...pickPublic() };
writeEnv(processPath, processEnv, ["# Local Process — synced from portal public keys"]);

const report = {
  portalSiteUrl: portal.NEXT_PUBLIC_SITE_URL,
  inspectUrl: portal.NEXT_PUBLIC_INSPECT_URL,
  policyUrl: portal.NEXT_PUBLIC_POLICY_URL,
  developmentUrl: portal.NEXT_PUBLIC_DEVELOPMENT_URL,
  processUrl: portal.NEXT_PUBLIC_PROCESS_URL,
  hasSupabaseUrl: Boolean(portal.NEXT_PUBLIC_SUPABASE_URL),
  hasAnon: Boolean(portal.NEXT_PUBLIC_SUPABASE_ANON_KEY || portal.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  hasServiceRole: Boolean(portal.SUPABASE_SERVICE_ROLE_KEY),
  hasPolicyEmbed: Boolean(portal.POLICY_EMBED_SECRET),
  hasInspectionEmbed: Boolean(portal.INSPECTION_EMBED_SECRET),
};
console.log(JSON.stringify(report, null, 2));
