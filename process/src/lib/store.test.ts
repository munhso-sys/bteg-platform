import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTree, collectSubtreeIds } from "./store";
import { computeAnalytics, deriveHealth } from "./analytics";
import { buildSeedDb } from "./seed";

describe("process store helpers", () => {
  it("builds a tree from seed nodes", () => {
    const db = buildSeedDb();
    const tree = buildTree(db.nodes);
    assert.equal(tree.length, 1);
    assert.equal(tree[0]?.code, "ACT-MINE-00");
    assert.ok((tree[0]?.children.length ?? 0) >= 2);
  });

  it("collects subtree ids", () => {
    const db = buildSeedDb();
    const ids = collectSubtreeIds(db.nodes, "proc_l3_load");
    assert.ok(ids.includes("proc_l3_load"));
    assert.ok(ids.includes("proc_l4_exc"));
    assert.ok(ids.includes("proc_l4_spot"));
    assert.equal(ids.includes("proc_l2_drill"), false);
  });

  it("computes analytics for loading activity", () => {
    const db = buildSeedDb();
    const a = computeAnalytics(db, "proc_l3_load");
    assert.ok(a);
    assert.ok(a!.open_issues_count >= 1);
    assert.ok(a!.procedures.length >= 1);
    assert.ok(["green", "yellow", "red", "neutral"].includes(a!.health));
  });

  it("derives health colors", () => {
    assert.equal(
      deriveHealth({
        openIssues: 0,
        criticalOpen: 0,
        complianceRate: 95,
        riskScore: 2,
      }),
      "green",
    );
    assert.equal(
      deriveHealth({
        openIssues: 1,
        criticalOpen: 0,
        complianceRate: 90,
        riskScore: 5,
      }),
      "yellow",
    );
    assert.equal(
      deriveHealth({
        openIssues: 1,
        criticalOpen: 1,
        complianceRate: 50,
        riskScore: 22,
      }),
      "red",
    );
  });
});
