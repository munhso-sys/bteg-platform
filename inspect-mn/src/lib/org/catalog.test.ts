import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { loadBundledOrgAccessOptions } from "./catalog";

describe("bundled org catalog", () => {
  it("loads non-empty heltes/albas/positions without filesystem data/", () => {
    const data = loadBundledOrgAccessOptions();
    assert.ok(data.heltes.length > 0);
    assert.ok(data.heltes.some((h) => h.albas.length > 0));
    assert.ok(
      data.heltes.some((h) => h.albas.some((a) => a.positions.length > 0)),
    );
  });

  it("matches policy bundled catalog hash (no silent drift)", () => {
    const portal = readFileSync(
      path.join(process.cwd(), "src/lib/org/org-catalog.json"),
    );
    const policy = readFileSync(
      path.join(
        process.cwd(),
        "../bgs-policy-compliance/src/lib/db/org-catalog.json",
      ),
    );
    const h1 = createHash("sha256").update(portal).digest("hex");
    const h2 = createHash("sha256").update(policy).digest("hex");
    assert.equal(h1, h2);
  });
});
