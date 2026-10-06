/**
 * Assign stable Preview aliases using Vercel CLI.
 * Run from repo root after module Preview deploys:
 *   node scripts/sync-preview-module-aliases.mjs
 */
import { execSync } from "child_process";

const MODULES = [
  {
    cwd: "bgs-policy-compliance",
    alias: "platform-policy-compliance-preview-munhso-9795s-projects.vercel.app",
  },
  {
    cwd: "inspection-center",
    alias: "platform-inspection-center-preview-munhso-9795s-projects.vercel.app",
  },
  {
    cwd: "development",
    alias: "platform-development-preview-munhso-9795s-projects.vercel.app",
  },
  {
    cwd: "process",
    alias: "platform-process-preview-munhso-9795s-projects.vercel.app",
  },
];

function run(cwd, command) {
  return execSync(`npx vercel ${command}`, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1" },
    shell: true,
  });
}

for (const mod of MODULES) {
  try {
    const list = run(mod.cwd, "ls --environment preview --non-interactive");
    const match = list.match(
      /https:\/\/(platform-[a-z0-9-]+-[a-z0-9]+-munhso-9795s-projects\.vercel\.app)/,
    );
    if (!match) {
      console.log(
        JSON.stringify({
          cwd: mod.cwd,
          error: "no_preview_url",
          snippet: list.slice(0, 400),
        }),
      );
      continue;
    }
    const deployment = match[1];
    const out = run(
      mod.cwd,
      `alias set ${deployment} ${mod.alias} --non-interactive`,
    );
    console.log(
      JSON.stringify({
        cwd: mod.cwd,
        deployment: `https://${deployment}`,
        alias: `https://${mod.alias}`,
        out: out.trim().split(/\r?\n/).slice(-3),
      }),
    );
  } catch (e) {
    console.log(
      JSON.stringify({
        cwd: mod.cwd,
        error: String(e.stderr || e.message).slice(0, 500),
      }),
    );
  }
}
