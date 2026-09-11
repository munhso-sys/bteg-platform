import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowUnscopedInspectionWrites,
  decideInspectionAdminAccess,
  decideInspectionWriteAccess,
  denyOnScopeResolutionError,
  isHostedOrProductionRuntime,
  isInspectionAdminScope,
  mutationAffectedRows,
} from "./write-access";
import type { InspectionEmbedClaims } from "./embed";

function claims(
  partial: Partial<InspectionEmbedClaims> & Pick<InspectionEmbedClaims, "mode">,
): InspectionEmbedClaims {
  return {
    v: 1,
    uid: "u1",
    role: partial.role ?? "inspector",
    heltesId: partial.heltesId ?? null,
    albaId: partial.albaId ?? null,
    heltesName: partial.heltesName ?? null,
    albaName: partial.albaName ?? null,
    mode: partial.mode,
    exp: Date.now() + 60_000,
  };
}

const hosted = { NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv;
const localDev = { NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv;

describe("IC-D05 fail-closed write access", () => {
  it("null scope is denied on hosted/production", () => {
    const d = decideInspectionWriteAccess(null, hosted);
    assert.equal(d.allow, false);
    if (!d.allow) {
      assert.equal(d.reason, "missing_scope");
      assert.equal(d.status, 401);
    }
  });

  it("null scope is allowed in local next dev", () => {
    assert.equal(allowUnscopedInspectionWrites(localDev), true);
    assert.equal(decideInspectionWriteAccess(null, localDev).allow, true);
    assert.equal(isInspectionAdminScope(null, localDev), true);
    assert.equal(decideInspectionAdminAccess(null, localDev).allow, true);
  });

  it("unit scope is denied", () => {
    const d = decideInspectionWriteAccess(claims({ mode: "unit" }), localDev);
    assert.equal(d.allow, false);
    if (!d.allow) {
      assert.equal(d.reason, "unit_readonly");
      assert.equal(d.status, 403);
    }
  });

  it("full mode inspector is allowed", () => {
    assert.equal(
      decideInspectionWriteAccess(claims({ mode: "full", role: "inspector" }))
        .allow,
      true,
    );
  });

  it("full mode manager is allowed for writes", () => {
    assert.equal(
      decideInspectionWriteAccess(claims({ mode: "full", role: "manager" }))
        .allow,
      true,
    );
  });

  it("full mode admin is allowed for writes and admin ops", () => {
    const scope = claims({ mode: "full", role: "admin" });
    assert.equal(decideInspectionWriteAccess(scope).allow, true);
    assert.equal(decideInspectionAdminAccess(scope).allow, true);
  });

  it("manager is denied for admin ops", () => {
    const d = decideInspectionAdminAccess(
      claims({ mode: "full", role: "manager" }),
    );
    assert.equal(d.allow, false);
    if (!d.allow) assert.equal(d.reason, "not_admin");
  });

  it("unknown role is not admin", () => {
    const scope = claims({ mode: "full", role: "unknown-role" });
    assert.equal(decideInspectionWriteAccess(scope).allow, true);
    assert.equal(isInspectionAdminScope(scope), false);
    assert.equal(decideInspectionAdminAccess(scope).allow, false);
  });

  it("null scope is never admin on hosted", () => {
    assert.equal(isInspectionAdminScope(null, hosted), false);
    assert.equal(decideInspectionAdminAccess(null, hosted).allow, false);
  });

  it("legacy unscoped flag is ignored on production even when set", () => {
    const env = {
      INSPECTION_ALLOW_UNSCOPED_WRITES: "1",
      INSPECTION_DEV_ALLOW_UNSCOPED_WRITES: "1",
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv;
    assert.equal(allowUnscopedInspectionWrites(env), false);
    assert.equal(decideInspectionWriteAccess(null, env).allow, false);
  });

  it("flag set + NODE_ENV=production still denied", () => {
    const env = {
      INSPECTION_ALLOW_UNSCOPED_WRITES: "1",
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv;
    assert.equal(isHostedOrProductionRuntime(env), true);
    assert.equal(decideInspectionWriteAccess(null, env).allow, false);
  });

  it("flag set + VERCEL=1 still denied", () => {
    const env = {
      INSPECTION_ALLOW_UNSCOPED_WRITES: "1",
      VERCEL: "1",
      NODE_ENV: "development",
    } as unknown as NodeJS.ProcessEnv;
    assert.equal(isHostedOrProductionRuntime(env), true);
    assert.equal(decideInspectionWriteAccess(null, env).allow, false);
  });

  it("flag set + VERCEL_ENV=preview still denied", () => {
    const env = {
      INSPECTION_ALLOW_UNSCOPED_WRITES: "1",
      VERCEL_ENV: "preview",
    } as unknown as NodeJS.ProcessEnv;
    assert.equal(decideInspectionWriteAccess(null, env).allow, false);
  });

  it("flag set + VERCEL_ENV=production still denied", () => {
    const env = {
      INSPECTION_ALLOW_UNSCOPED_WRITES: "1",
      VERCEL_ENV: "production",
    } as unknown as NodeJS.ProcessEnv;
    assert.equal(decideInspectionWriteAccess(null, env).allow, false);
  });

  it("explicit flag allows unscoped on non-dev local (e.g. next start)", () => {
    const env = {
      NODE_ENV: "test",
      INSPECTION_ALLOW_UNSCOPED_WRITES: "1",
    } as unknown as NodeJS.ProcessEnv;
    assert.equal(allowUnscopedInspectionWrites(env), true);
    assert.equal(decideInspectionWriteAccess(null, env).allow, true);
  });

  it("scope resolution error denies", () => {
    const d = denyOnScopeResolutionError(new Error("lookup failed"));
    assert.equal(d.allow, false);
  });

  it("zero affected rows is not success", () => {
    assert.equal(mutationAffectedRows(0).ok, false);
    assert.equal(mutationAffectedRows(null).ok, false);
    assert.equal(mutationAffectedRows(1).ok, true);
  });

  it("unit-scoped user cannot perform org-wide write", () => {
    const d = decideInspectionWriteAccess(
      claims({
        mode: "unit",
        role: "manager",
        heltesId: "other-org-unit",
      }),
    );
    assert.equal(d.allow, false);
  });
});
