import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import {
  decideDevelopmentNavigation,
  firstAllowedDevelopmentPath,
  inspectModuleNavGrant,
  isDevelopmentPathAllowed,
  isNavEnforcementActive,
  type ModuleNavGrant,
} from "./nav-grant";
import { isNavG1Enforce } from "./nav-authorize";
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
    "DEVELOPMENT_NAV_SECRET",
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
  moduleId: "development",
  menuIds: ["/dashboard", "/projects"],
  submenuIds: {},
  exp: Date.now() + 60_000,
  ...over,
});

describe("N2 Development nav (VALID / invalid grant paths)", () => {
  it("VALID DEVELOPMENT_NAV_SECRET grant verifies, preserves catalogVersion v1, allows/denies routes", async () => {
    await withSecrets({ DEVELOPMENT_NAV_SECRET: "n2-dev" }, async () => {
      const token = sign("n2-dev", grantPayload({ catalogVersion: "v1" }));
      const r = await inspectModuleNavGrant(token, "development");
      assert.equal(r.state, "valid");
      if (r.state !== "valid") return;
      assert.equal(r.grant.catalogVersion, "v1");
      assert.equal(isDevelopmentPathAllowed("/projects/1", r.grant, false), true);
      assert.equal(isDevelopmentPathAllowed("/settings", r.grant, false), false);
      assert.equal(isDevelopmentPathAllowed("/unmapped", r.grant, false), false);
      assert.equal(firstAllowedDevelopmentPath(r.grant), "/dashboard");
    });
  });

  it("embed-secret fallback grant (rollout) still valid", async () => {
    await withSecrets({ INSPECTION_EMBED_SECRET: "legacy" }, async () => {
      const r = await inspectModuleNavGrant(sign("legacy", grantPayload()), "development");
      assert.equal(r.state, "valid");
    });
  });

  it("invalid signature / wrong module / malformed → invalid; expired → expired", async () => {
    await withSecrets({ DEVELOPMENT_NAV_SECRET: "n2-dev" }, async () => {
      assert.equal(
        (await inspectModuleNavGrant(sign("bad", grantPayload()), "development")).state,
        "invalid",
      );
      assert.equal(
        (await inspectModuleNavGrant(sign("n2-dev", grantPayload({ moduleId: "process" })), "development")).state,
        "invalid",
      );
      assert.equal(
        (await inspectModuleNavGrant(
          sign("n2-dev", grantPayload({ menuIds: null as unknown as string[] })),
          "development",
        )).state,
        "invalid",
      );
      assert.equal(
        (await inspectModuleNavGrant(sign("n2-dev", grantPayload({ exp: 1 })), "development")).state,
        "expired",
      );
    });
  });

  it("no secret configured → invalid (fail closed)", async () => {
    await withSecrets({}, async () => {
      assert.equal(
        (await inspectModuleNavGrant(sign("x", grantPayload()), "development")).state,
        "invalid",
      );
    });
  });
});

describe("N2/N6 Development missing grant: compat vs G1 fail-closed", () => {
  it("pre-G1: no grant → ALLOW + nav.compat_allow", () => {
    const d = decideDevelopmentNavigation("/projects", null, { g1: false, emit: true });
    assert.equal(d.allow, true);
    assert.equal(events[0]?.event, "nav.compat_allow");
  });

  it("G1: no grant → DENY + nav.config_missing", () => {
    const d = decideDevelopmentNavigation("/projects", null, { g1: true, emit: true });
    assert.equal(d.allow, false);
    assert.equal(events[0]?.event, "nav.config_missing");
  });

  it("flag from env drives isDevelopmentPathAllowed(null)", async () => {
    await withSecrets({}, () => {
      assert.equal(isNavG1Enforce(), false);
      assert.equal(isDevelopmentPathAllowed("/projects", null), true);
    });
    await withSecrets({ NAV_G1_ENFORCE: "1" }, () => {
      assert.equal(isDevelopmentPathAllowed("/projects", null), false);
    });
  });

  it("enforce marker denies without grant even with flag off", () => {
    assert.equal(
      decideDevelopmentNavigation("/projects", null, {
        enforceMarker: isNavEnforcementActive("1"),
        g1: false,
      }).allow,
      false,
    );
  });

  it("token states map to telemetry events", () => {
    decideDevelopmentNavigation("/x", null, { tokenState: "invalid", emit: true });
    decideDevelopmentNavigation("/x", null, { tokenState: "expired", emit: true });
    decideDevelopmentNavigation("/projects", grantPayload(), { emit: true, g1: false });
    assert.deepEqual(
      events.map((e) => e.event),
      ["nav.token_invalid", "nav.token_expired", "nav.allow"],
    );
  });
});
