import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDevelopmentPathAllowed,
  isNavEnforcementActive,
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

describe("N1 Development nav grant", () => {
  const baseGrant: ModuleNavGrant = {
    v: 1,
    moduleId: "development",
    menuIds: ["/dashboard", "/projects"],
    submenuIds: {},
    exp: Date.now() + 60_000,
  };

  it("valid grant allows mapped route", () => {
    assert.equal(isDevelopmentPathAllowed("/projects", baseGrant), true);
    assert.equal(isDevelopmentPathAllowed("/settings", baseGrant), false);
  });

  it("invalid / expired → verify null (middleware fail-closed)", async () => {
    const prev = process.env.POLICY_EMBED_SECRET;
    process.env.POLICY_EMBED_SECRET = "n1-dev-secret";
    try {
      assert.equal(
        await verifyModuleNavGrant("not.a.token", "development"),
        null,
      );
      const { createHmac } = await import("node:crypto");
      const payload = { ...baseGrant, exp: 1 };
      const body = b64url(JSON.stringify(payload));
      const sig = createHmac("sha256", "n1-dev-secret")
        .update(body)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      assert.equal(
        await verifyModuleNavGrant(`${body}.${sig}`, "development"),
        null,
      );
    } finally {
      if (prev === undefined) delete process.env.POLICY_EMBED_SECRET;
      else process.env.POLICY_EMBED_SECRET = prev;
    }
  });

  it("enforce marker distinguishes absent vs prior invalid session", () => {
    assert.equal(isNavEnforcementActive(null), false);
    assert.equal(isNavEnforcementActive("1"), true);
  });
});
