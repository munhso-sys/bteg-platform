import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  decideInspectionAdminAccess,
  decideInspectionWriteAccess,
  isInspectionAdminScope,
  allowUnscopedInspectionWrites,
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

describe("IC-D05 fail-closed write access", () => {
  const prevEscape = process.env.INSPECTION_ALLOW_UNSCOPED_WRITES;

  beforeEach(() => {
    delete process.env.INSPECTION_ALLOW_UNSCOPED_WRITES;
  });

  afterEach(() => {
    if (prevEscape === undefined) {
      delete process.env.INSPECTION_ALLOW_UNSCOPED_WRITES;
    } else {
      process.env.INSPECTION_ALLOW_UNSCOPED_WRITES = prevEscape;
    }
  });

  it("null scope is denied (fail-closed)", () => {
    const d = decideInspectionWriteAccess(null);
    assert.equal(d.allow, false);
    if (!d.allow) {
      assert.equal(d.reason, "missing_scope");
      assert.equal(d.status, 401);
    }
  });

  it("unit scope is denied", () => {
    const d = decideInspectionWriteAccess(claims({ mode: "unit" }));
    assert.equal(d.allow, false);
    if (!d.allow) {
      assert.equal(d.reason, "unit_readonly");
      assert.equal(d.status, 403);
    }
  });

  it("full mode scope is allowed", () => {
    const d = decideInspectionWriteAccess(
      claims({ mode: "full", role: "manager" }),
    );
    assert.equal(d.allow, true);
  });

  it("null scope is not admin", () => {
    assert.equal(isInspectionAdminScope(null), false);
    const d = decideInspectionAdminAccess(null);
    assert.equal(d.allow, false);
  });

  it("full admin is allowed for admin ops", () => {
    const d = decideInspectionAdminAccess(
      claims({ mode: "full", role: "admin" }),
    );
    assert.equal(d.allow, true);
  });

  it("full non-admin is denied for admin ops", () => {
    const d = decideInspectionAdminAccess(
      claims({ mode: "full", role: "inspector" }),
    );
    assert.equal(d.allow, false);
    if (!d.allow) assert.equal(d.reason, "not_admin");
  });

  it("explicit local escape allows unscoped writes only when env=1", () => {
    assert.equal(allowUnscopedInspectionWrites(), false);
    process.env.INSPECTION_ALLOW_UNSCOPED_WRITES = "1";
    assert.equal(allowUnscopedInspectionWrites(), true);
    assert.equal(decideInspectionWriteAccess(null).allow, true);
  });
});
