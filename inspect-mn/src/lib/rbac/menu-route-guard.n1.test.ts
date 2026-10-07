import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPathAllowedByMenuSelection,
  normalizeMenuSelection,
  resolvePortalTopMenuPath,
  resolveRiskMenuPath,
} from "./menu-route-guard";

describe("N1 portal menu-route-guard", () => {
  it("1. config exists + known allowed path → ALLOW", () => {
    const selection = {
      menuIds: ["risk-management", "inspection"],
      submenuIds: {},
    };
    assert.equal(
      isPathAllowedByMenuSelection(
        "/risk-management",
        selection,
        resolvePortalTopMenuPath,
      ),
      true,
    );
  });

  it("2. config exists + known denied path → DENY", () => {
    const selection = {
      menuIds: ["inspection"],
      submenuIds: {},
    };
    assert.equal(
      isPathAllowedByMenuSelection(
        "/risk-management",
        selection,
        resolvePortalTopMenuPath,
      ),
      false,
    );
  });

  it("3. config exists + unmapped protected path → DENY", () => {
    const selection = {
      menuIds: ["/risk-management"],
      submenuIds: {},
    };
    // Path outside resolver map while config is active
    assert.equal(
      isPathAllowedByMenuSelection(
        "/totally-unknown-surface",
        selection,
        resolveRiskMenuPath,
      ),
      false,
    );
  });

  it("4. no config → pre-NAV-G1 ALLOW", () => {
    assert.equal(
      isPathAllowedByMenuSelection(
        "/risk-management",
        null,
        resolvePortalTopMenuPath,
      ),
      true,
    );
    assert.equal(
      isPathAllowedByMenuSelection(
        "/totally-unknown",
        undefined,
        resolvePortalTopMenuPath,
      ),
      true,
    );
  });

  it("5. null menuIds on selection object → no 500, treated as empty allowlist", () => {
    const selection = {
      menuIds: null as unknown as string[],
      submenuIds: null as unknown as Record<string, string[]>,
    };
    assert.doesNotThrow(() => {
      assert.equal(
        isPathAllowedByMenuSelection(
          "/inspection",
          selection,
          resolvePortalTopMenuPath,
        ),
        false,
      );
    });
    const normalized = normalizeMenuSelection(selection);
    assert.ok(normalized);
    assert.deepEqual(normalized.menuIds, []);
  });
});
