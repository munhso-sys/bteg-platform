import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import {
  decideProcessNavigation,
  firstAllowedProcessPath,
  inspectModuleNavGrant,
  isNavEnforcementActive,
  isProcessPathAllowed,
  type ModuleNavGrant,
} from "./nav-grant";
import { authorizeNavigation, isNavG1Enforce } from "./nav-authorize";
import { setNavTelemetrySink, type NavTelemetryRecord } from "./nav-telemetry";

const events: NavTelemetryRecord[] = [];
setNavTelemetrySink((r) => events.push(r));
afterEach(() => {
  events.length = 0;
});

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sign(secret: string, payload: unknown) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

async function withSecrets<T>(
  secrets: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const keys = [
    "POLICY_EMBED_SECRET",
    "INSPECTION_EMBED_SECRET",
    "PROCESS_NAV_SECRET",
    "NAV_G1_ENFORCE",
  ];
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(secrets)) {
    if (v !== undefined) process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

const grantPayload = (over: Partial<ModuleNavGrant> = {}): ModuleNavGrant => ({
  v: 1,
  moduleId: "process",
  menuIds: ["/dashboard", "/processes"],
  submenuIds: {},
  exp: Date.now() + 60_000,
  ...over,
});

describe("N2 Process nav (VALID / invalid grant paths)", () => {
  it("VALID PROCESS_NAV_SECRET grant verifies, preserves catalogVersion v1, allows/denies routes", async () => {
    await withSecrets({ PROCESS_NAV_SECRET: "n2-process" }, async () => {
      const token = sign("n2-process", grantPayload({ catalogVersion: "v1" }));
      const r = await inspectModuleNavGrant(token, "process");
      assert.equal(r.state, "valid");
      if (r.state !== "valid") return;
      assert.equal(r.grant.catalogVersion, "v1");
      assert.equal(isProcessPathAllowed("/processes/abc", r.grant, false), true);
      assert.equal(isProcessPathAllowed("/documents", r.grant, false), false);
      assert.equal(isProcessPathAllowed("/unmapped", r.grant, false), false);
      assert.equal(firstAllowedProcessPath(r.grant), "/dashboard");
    });
  });

  it("grant without catalogVersion (legacy v1) still valid", async () => {
    await withSecrets({ POLICY_EMBED_SECRET: "legacy" }, async () => {
      const r = await inspectModuleNavGrant(sign("legacy", grantPayload()), "process");
      assert.equal(r.state, "valid");
      if (r.state === "valid") assert.equal(r.grant.catalogVersion, undefined);
    });
  });

  it("invalid signature / wrong module / malformed payload → invalid", async () => {
    await withSecrets({ PROCESS_NAV_SECRET: "n2-process" }, async () => {
      assert.equal(
        (await inspectModuleNavGrant(sign("wrong-secret", grantPayload()), "process")).state,
        "invalid",
      );
      assert.equal(
        (await inspectModuleNavGrant(sign("n2-process", grantPayload({ moduleId: "development" })), "process")).state,
        "invalid",
      );
      assert.equal(
        (await inspectModuleNavGrant(
          sign("n2-process", grantPayload({ menuIds: "x" as unknown as string[] })),
          "process",
        )).state,
        "invalid",
      );
      assert.equal((await inspectModuleNavGrant("a.b", "process")).state, "invalid");
      assert.equal((await inspectModuleNavGrant(null, "process")).state, "invalid");
    });
  });

  it("no secret configured → every token invalid (fail closed)", async () => {
    await withSecrets({}, async () => {
      assert.equal(
        (await inspectModuleNavGrant(sign("anything", grantPayload()), "process")).state,
        "invalid",
      );
    });
  });

  it("expired grant → expired (distinct from invalid)", async () => {
    await withSecrets({ PROCESS_NAV_SECRET: "n2-process" }, async () => {
      const token = sign("n2-process", grantPayload({ exp: Date.now() - 1 }));
      assert.equal((await inspectModuleNavGrant(token, "process")).state, "expired");
    });
  });
});

describe("N2/N6 Process missing grant: compat vs G1 fail-closed", () => {
  it("pre-G1 (flag off): no grant + no enforce marker → ALLOW + nav.compat_allow", () => {
    const d = decideProcessNavigation("/processes", null, { g1: false, emit: true });
    assert.deepEqual(d, { allow: true, reason: "compat_allow" });
    assert.equal(events[0]?.event, "nav.compat_allow");
    assert.equal(isProcessPathAllowed("/anything", null, false), true);
  });

  it("G1 on: no grant → DENY (reembed) + nav.config_missing", () => {
    const d = decideProcessNavigation("/processes", null, { g1: true, emit: true });
    assert.equal(d.allow, false);
    if (!d.allow) {
      assert.equal(d.reason, "config_missing");
      assert.equal(d.action, "reembed");
    }
    assert.equal(events[0]?.event, "nav.config_missing");
    assert.equal(isProcessPathAllowed("/processes", null, true), false);
  });

  it("flag read from env: default off, '1' on", async () => {
    await withSecrets({}, () => {
      assert.equal(isNavG1Enforce(), false);
      assert.equal(isProcessPathAllowed("/processes", null), true);
    });
    await withSecrets({ NAV_G1_ENFORCE: "1" }, () => {
      assert.equal(isNavG1Enforce(), true);
      assert.equal(isProcessPathAllowed("/processes", null), false);
    });
  });

  it("enforce marker without grant denies even with flag off (N1-04)", () => {
    assert.equal(isNavEnforcementActive("1"), true);
    const d = decideProcessNavigation("/processes", null, {
      enforceMarker: isNavEnforcementActive("1"),
      g1: false,
    });
    assert.equal(d.allow, false);
  });

  it("G1 on does not block a valid grant", () => {
    assert.equal(isProcessPathAllowed("/processes", grantPayload(), true), true);
  });

  it("token states map to telemetry events", () => {
    decideProcessNavigation("/x", null, { tokenState: "invalid", emit: true });
    decideProcessNavigation("/x", null, { tokenState: "expired", emit: true });
    decideProcessNavigation("/unmapped", grantPayload(), { emit: true, g1: false });
    decideProcessNavigation("/documents", grantPayload(), { emit: true, g1: false });
    decideProcessNavigation("/processes", grantPayload(), { emit: true, g1: false });
    assert.deepEqual(
      events.map((e) => e.event),
      ["nav.token_invalid", "nav.token_expired", "nav.route_unmapped", "nav.deny", "nav.allow"],
    );
  });

  it("telemetry never contains token material", () => {
    const token = sign("secret-x", grantPayload());
    authorizeNavigation({
      moduleId: "process",
      pathname: `/dashboard?nav=${token}`,
      selection: null,
      resolve: () => null,
      g1: true,
    });
    assert.equal(JSON.stringify(events).includes(token), false);
    assert.equal(events[0]?.path, "/dashboard");
  });
});
