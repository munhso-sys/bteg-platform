/**
 * Preview-gate local E2E orchestrator.
 * - Loads local Supabase status (no secret printing)
 * - Seeds two org users
 * - Starts next start servers with local env overrides
 * - Runs Playwright
 * - Stops servers
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inspectMn = path.join(root, "inspect-mn");
const require = createRequire(import.meta.url);
const { createClient } = require(
  path.join(root, "inspect-mn/node_modules/@supabase/supabase-js"),
);

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
  };
}

async function ensureUser(admin, email, password, heltesId) {
  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  let user = listed.data.users.find((u) => u.email === email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw created.error;
    user = created.data.user;
  }
  await admin.from("roles").upsert({
    id: "inspector",
    label: "Inspector",
    sort_order: 2,
  });
  const { error } = await admin.from("user_profiles").upsert({
    user_id: user.id,
    email,
    full_name: email,
    heltes_id: heltesId,
    role_id: "inspector",
    status: "active",
  });
  if (error) throw error;
}

function waitHttp(url, timeoutMs = 180_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        console.log(`HTTP ${res.statusCode} ${url}`);
        resolve(true);
      });
      req.setTimeout(3000, () => {
        req.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error(`timeout ${url}`));
        else setTimeout(tick, 1500);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`timeout ${url}`));
        else setTimeout(tick, 1500);
      });
    };
    tick();
  });
}

function startApp(cwd, port, env) {
  const logPath = path.join(root, `docs/prod-audit/e2e-server-${port}.log`);
  const log = fs.createWriteStream(logPath, { flags: "w" });
  const child = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["next", "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd,
      env: { ...process.env, ...env, PORT: String(port) },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on("exit", (code) => {
    console.log(`EXIT server :${port} code=${code}`);
  });
  return child;
}

async function main() {
  const status = loadLocalStatus();
  const admin = createClient(status.url, status.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await ensureUser(admin, "e2e-org-a@example.com", "Passw0rd!e2eA", "org-a");
  await ensureUser(admin, "e2e-org-b@example.com", "Passw0rd!e2eB", "org-b");
  console.log("SEED_USERS=ok");

  const embedSecret = "e2e-local-embed-secret-preview-gate";
  const commonEnv = {
    NEXT_PUBLIC_SUPABASE_URL: status.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.anon,
    SUPABASE_SERVICE_ROLE_KEY: status.service,
    POLICY_EMBED_SECRET: embedSecret,
    INSPECTION_EMBED_SECRET: embedSecret,
    NODE_ENV: "production",
  };

  const apps = [
    { name: "portal", cwd: path.join(root, "inspect-mn"), port: 3100, ready: "http://127.0.0.1:3100/api/runtime-info" },
    { name: "inspection", cwd: path.join(root, "inspection-center"), port: 3101, ready: "http://127.0.0.1:3101/" },
    { name: "development", cwd: path.join(root, "development"), port: 3103, ready: "http://127.0.0.1:3103/" },
  ];

  const children = [];
  try {
    for (const app of apps) {
      console.log(`START ${app.name} :${app.port}`);
      children.push(startApp(app.cwd, app.port, commonEnv));
      await waitHttp(app.ready);
      console.log(`READY ${app.name}`);
    }

    const env = {
      ...process.env,
      ...commonEnv,
      E2E_PORTAL_URL: "http://127.0.0.1:3100",
      E2E_INSPECTION_URL: "http://127.0.0.1:3101",
      E2E_DEVELOPMENT_URL: "http://127.0.0.1:3103",
      E2E_STRICT: "1",
      INSPECTION_EMBED_SECRET: embedSecret,
    };
    const pw = spawnSync("npx", ["playwright", "test", "--reporter=list"], {
      cwd: root,
      env,
      shell: true,
      encoding: "utf8",
    });
    process.stdout.write(pw.stdout || "");
    process.stderr.write(pw.stderr || "");
    const report = {
      exitCode: pw.status,
      at: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(root, "docs/prod-audit/e2e-last-run.json"),
      JSON.stringify(report, null, 2),
    );
    process.exitCode = pw.status ?? 1;
  } finally {
    for (const c of children) {
      try {
        c.kill("SIGTERM");
      } catch {
        // ignore
      }
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
