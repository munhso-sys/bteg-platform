import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  choosePolicyEmbedMode,
  choosePolicyEntryPath,
  withTimeout,
} from "./policy-embed-build-core";
import {
  positionFromProfile,
  resolvePositionIdViaPolicyApi,
} from "./policy-position-resolve";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function delayedFetch(delayMs: number): typeof fetch {
  return (async () => {
    await sleep(delayMs);
    return new Response(
      JSON.stringify({ ok: true, id: "pos-norm", name: "Normalized" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

describe("RC1 — remote position resolve dominates Portal Policy SSR", () => {
  it("fast resolve completes quickly", async () => {
    const t0 = Date.now();
    const out = await resolvePositionIdViaPolicyApi("raw-1", "Raw", {
      fetchImpl: delayedFetch(20),
      timeoutMs: 8000,
    });
    const ms = Date.now() - t0;
    assert.equal(out?.id, "pos-norm");
    assert.ok(ms < 500, `expected fast resolve, got ${ms}ms`);
  });

  it("4s resolve waits ~4s (scales with remote)", async () => {
    const t0 = Date.now();
    await resolvePositionIdViaPolicyApi("raw-1", "Raw", {
      fetchImpl: delayedFetch(4000),
      timeoutMs: 8000,
    });
    const ms = Date.now() - t0;
    assert.ok(ms >= 3800, `expected ~4s, got ${ms}ms`);
    assert.ok(ms < 5500, `expected not much over 4s, got ${ms}ms`);
  });

  it("8s resolve consumes most of a ~10s serverless budget", async () => {
    const t0 = Date.now();
    await resolvePositionIdViaPolicyApi("raw-1", "Raw", {
      fetchImpl: delayedFetch(8000),
      timeoutMs: 9000,
    });
    const ms = Date.now() - t0;
    assert.ok(ms >= 7800, `expected ~8s, got ${ms}ms`);
    // RC1-CONFIRMED: remote resolver alone can exhaust Hobby function budget.
    assert.ok(ms >= 7000, "RC1-CONFIRMED: resolve dominates non-admin SSR");
  });
});

describe("fix — profile fields + mode selection (no remote)", () => {
  it("positionFromProfile uses trusted portal fields only", () => {
    assert.deepEqual(
      positionFromProfile({
        position_id: "p1",
        position_name: "Specialist",
      }),
      { id: "p1", name: "Specialist" },
    );
    assert.deepEqual(positionFromProfile({}), { id: null, name: null });
  });

  it("non-edit with Role эрх menus → view, not position /my", () => {
    const mode = choosePolicyEmbedMode({
      canEdit: false,
      isUnitScoped: false,
      unitActive: false,
      isPositionScoped: true,
      hasRoleMenus: true,
    });
    assert.equal(mode, "view");
    assert.equal(
      choosePolicyEntryPath({
        mode,
        positionId: "p1",
        unit: { heltesId: null, albaId: null },
        menus: ["/dashboard", "/policies"],
        submenus: null,
      }),
      "/dashboard",
    );
  });

  it("position-scoped without menus → position /my (workplace-only)", () => {
    const mode = choosePolicyEmbedMode({
      canEdit: false,
      isUnitScoped: false,
      unitActive: false,
      isPositionScoped: true,
      hasRoleMenus: false,
    });
    assert.equal(mode, "position");
    assert.equal(
      choosePolicyEntryPath({
        mode,
        positionId: null,
        unit: { heltesId: null, albaId: null },
        menus: null,
        submenus: null,
      }),
      "/my",
    );
  });

  it("canEdit → full; does not escalate from missing position", () => {
    assert.equal(
      choosePolicyEmbedMode({
        canEdit: true,
        isUnitScoped: false,
        unitActive: false,
        isPositionScoped: false,
        hasRoleMenus: false,
      }),
      "full",
    );
    assert.equal(
      choosePolicyEmbedMode({
        canEdit: false,
        isUnitScoped: false,
        unitActive: false,
        isPositionScoped: false,
        hasRoleMenus: false,
      }),
      "view",
    );
  });

  it("outer budget rejects slow work before serverless limit", async () => {
    const t0 = Date.now();
    await assert.rejects(
      () => withTimeout(sleep(3000).then(() => "x"), 200, "policy embed"),
      /timed out after 200ms/,
    );
    const ms = Date.now() - t0;
    assert.ok(ms < 800, `budget must cut short, got ${ms}ms`);
  });
});
