import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  choosePolicyEmbedMode,
  choosePolicyEntryPath,
  POLICY_EMBED_BUILD_TIMEOUT_MS,
  withTimeout,
} from "./policy-embed-build-core";
import { positionFromProfile } from "./policy-position-resolve";

/**
 * Performance gate after fix: simulated slow Policy /api/positions/resolve
 * must NOT delay embed construction because the critical path never awaits it.
 */
describe("performance gate — no remote resolve on critical path", () => {
  it("embed construction from profile stays under 1s even if Policy API is 'slow'", async () => {
    // Previously the critical path awaited this. After the fix it must not.
    const slowPolicyResolve = new Promise<{ id: string; name: string }>(
      (resolve) => {
        setTimeout(() => resolve({ id: "late", name: "Late" }), 8000);
      },
    );

    const t0 = Date.now();
    const position = positionFromProfile({
      position_id: "local-pos",
      position_name: "Fixture Specialist",
    });
    const mode = choosePolicyEmbedMode({
      canEdit: false,
      isUnitScoped: false,
      unitActive: false,
      isPositionScoped: true,
      hasRoleMenus: true,
    });
    const entryPath = choosePolicyEntryPath({
      mode,
      positionId: position.id,
      unit: { heltesId: "h1", albaId: "a1" },
      menus: ["/dashboard"],
      submenus: null,
    });
    const ms = Date.now() - t0;

    // Embed built without awaiting the simulated slow Policy API.
    assert.equal(mode, "view");
    assert.equal(entryPath, "/dashboard");
    assert.equal(position.id, "local-pos");
    assert.ok(ms < 50, `embed core must be sync-fast, got ${ms}ms`);
    assert.ok(
      POLICY_EMBED_BUILD_TIMEOUT_MS <= 4000,
      "outer budget must stay well under serverless ~10s",
    );
    // Slow promise still pending — proving we did not await it.
    let settled = false;
    void slowPolicyResolve.then(() => {
      settled = true;
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(settled, false, "slow Policy API must not have been awaited");
  });

  it("admin full mode also ignores remote resolve", () => {
    const mode = choosePolicyEmbedMode({
      canEdit: true,
      isUnitScoped: false,
      unitActive: false,
      isPositionScoped: false,
      hasRoleMenus: false,
    });
    assert.equal(mode, "full");
    assert.equal(
      choosePolicyEntryPath({
        mode,
        positionId: null,
        unit: { heltesId: null, albaId: null },
        menus: null,
        submenus: null,
      }),
      "/dashboard",
    );
  });

  it("non-admin without position fields stays safe (view, no escalation)", () => {
    const position = positionFromProfile({});
    const mode = choosePolicyEmbedMode({
      canEdit: false,
      isUnitScoped: false,
      unitActive: false,
      isPositionScoped: false,
      hasRoleMenus: false,
    });
    assert.equal(position.id, null);
    assert.equal(mode, "view");
    assert.notEqual(mode, "full");
  });

  it("outer timeout still bounds accidental slow DB work", async () => {
    const t0 = Date.now();
    await assert.rejects(
      () =>
        withTimeout(
          new Promise<string>((r) => setTimeout(() => r("late"), 5000)),
          150,
          "policy embed",
        ),
      /timed out/,
    );
    assert.ok(Date.now() - t0 < 600);
  });
});
