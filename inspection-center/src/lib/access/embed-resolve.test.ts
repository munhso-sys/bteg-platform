import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  softUnitQueryIsTrustedAuthority,
  resolveInspectionEmbedFromParts,
} from "./embed-resolve";
import { signInspectionEmbedToken } from "./embed";

describe("IC-D01 soft unit mint disabled", () => {
  it("unsigned scope=unit query is not a trusted mint authority", () => {
    assert.equal(softUnitQueryIsTrustedAuthority(), false);
  });

  it("resolve ignores soft query-shaped inputs when only embed/cookie are considered", async () => {
    const prev = process.env.INSPECTION_EMBED_SECRET;
    process.env.INSPECTION_EMBED_SECRET = "ic-d01-regression-secret";
    try {
      const resolved = await resolveInspectionEmbedFromParts({
        embedParam: null,
        cookieToken: null,
      });
      assert.equal(resolved, null);
    } finally {
      if (prev === undefined) delete process.env.INSPECTION_EMBED_SECRET;
      else process.env.INSPECTION_EMBED_SECRET = prev;
    }
  });

  it("portal-signed embed still resolves", async () => {
    const prev = process.env.INSPECTION_EMBED_SECRET;
    process.env.INSPECTION_EMBED_SECRET = "ic-d01-regression-secret";
    try {
      const token = await signInspectionEmbedToken({
        uid: "u1",
        role: "inspector",
        heltesId: "h1",
        albaId: null,
        heltesName: "Heltes",
        albaName: null,
        mode: "unit",
        exp: Date.now() + 60_000,
      });
      assert.ok(token);
      const resolved = await resolveInspectionEmbedFromParts({
        embedParam: token,
        cookieToken: null,
      });
      assert.ok(resolved);
      assert.equal(resolved.source, "embed");
      assert.equal(resolved.claims.mode, "unit");
      assert.equal(resolved.claims.heltesName, "Heltes");
    } finally {
      if (prev === undefined) delete process.env.INSPECTION_EMBED_SECRET;
      else process.env.INSPECTION_EMBED_SECRET = prev;
    }
  });

  it("middleware source must not call soft mint helper", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/middleware.ts"),
      "utf8",
    );
    assert.doesNotMatch(src, /mintSoftUnitToken/);
    assert.match(src, /resolveInspectionEmbedFromParts/);
    assert.match(src, /IC-D01/);
  });
});
