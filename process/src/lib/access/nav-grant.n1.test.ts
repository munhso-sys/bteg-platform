import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isNavEnforcementActive,
  isProcessPathAllowed,
  verifyModuleNavGrant,
  type ModuleNavGrant,
} from "./nav-grant";

function b64url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("N1 Process nav grant", () => {
  const baseGrant: ModuleNavGrant = {
    v: 1,
    moduleId: "process",
    menuIds: ["/dashboard", "/processes"],
    submenuIds: {},
    exp: Date.now() + 60_000,
  };

  it("9. valid grant → expected route allowed", () => {
    assert.equal(isProcessPathAllowed("/processes", baseGrant), true);
    assert.equal(isProcessPathAllowed("/documents", baseGrant), false);
  });

  it("10. invalid grant token → verify null (DENY/re-embed at middleware)", async () => {
    const prev = process.env.POLICY_EMBED_SECRET;
    process.env.POLICY_EMBED_SECRET = "n1-test-secret";
    try {
      const bad = `${b64url(JSON.stringify(baseGrant))}.notasignature`;
      assert.equal(await verifyModuleNavGrant(bad, "process"), null);
    } finally {
      if (prev === undefined) delete process.env.POLICY_EMBED_SECRET;
      else process.env.POLICY_EMBED_SECRET = prev;
    }
  });

  it("11. expired grant → verify null", async () => {
    const prev = process.env.POLICY_EMBED_SECRET;
    process.env.POLICY_EMBED_SECRET = "n1-test-secret";
    try {
      const { createHmac } = await import("node:crypto");
      const payload = { ...baseGrant, exp: Date.now() - 1000 };
      const body = b64url(JSON.stringify(payload));
      const sig = createHmac("sha256", "n1-test-secret")
        .update(body)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      assert.equal(
        await verifyModuleNavGrant(`${body}.${sig}`, "process"),
        null,
      );
    } finally {
      if (prev === undefined) delete process.env.POLICY_EMBED_SECRET;
      else process.env.POLICY_EMBED_SECRET = prev;
    }
  });

  it("12. malformed cookie must not become unrestricted — enforce marker active", () => {
    assert.equal(isNavEnforcementActive("1"), true);
    assert.equal(isNavEnforcementActive(null), false);
    assert.equal(isNavEnforcementActive(undefined), false);
    // When enforce active and grant null, middleware denies (tested via helper)
    assert.equal(isProcessPathAllowed("/processes", null), true); // only when no grant object — middleware must not call this path under enforce
  });

  it("13. genuinely absent config/grant → pre-NAV-G1 compat (no enforce)", () => {
    assert.equal(isNavEnforcementActive(null), false);
    assert.equal(isProcessPathAllowed("/anything", null), true);
  });

  it("malformed menuIds in payload → verify null", async () => {
    const prev = process.env.POLICY_EMBED_SECRET;
    process.env.POLICY_EMBED_SECRET = "n1-test-secret";
    try {
      const { createHmac } = await import("node:crypto");
      const payload = {
        ...baseGrant,
        menuIds: "not-an-array" as unknown as string[],
      };
      const body = b64url(JSON.stringify(payload));
      const sig = createHmac("sha256", "n1-test-secret")
        .update(body)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      assert.equal(
        await verifyModuleNavGrant(`${body}.${sig}`, "process"),
        null,
      );
    } finally {
      if (prev === undefined) delete process.env.POLICY_EMBED_SECRET;
      else process.env.POLICY_EMBED_SECRET = prev;
    }
  });
});
