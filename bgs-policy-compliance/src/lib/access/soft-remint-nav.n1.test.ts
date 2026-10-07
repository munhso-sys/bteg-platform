import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideSoftRemintNavigation,
  hasExplicitNavClaims,
} from "./soft-remint-nav";
import {
  isPathAllowedByMenuSelection,
  resolvePolicyMenuPath,
} from "./menu-route-guard";

describe("N1 Policy soft-remint + management deny", () => {
  it("6. prior signed menus/submenus preserved on soft re-mint", () => {
    const d = decideSoftRemintNavigation({
      cookiePresent: true,
      priorClaims: {
        menus: ["/dashboard", "/policies"],
        submenus: { "/policies": ["/policies/review"] },
      },
    });
    assert.equal(d.action, "proceed");
    if (d.action === "proceed") {
      assert.deepEqual(d.menus, ["/dashboard", "/policies"]);
      assert.deepEqual(d.submenus, {
        "/policies": ["/policies/review"],
      });
    }
  });

  it("7. enforced session + missing prior nav claims → no unrestricted escalation", () => {
    const d = decideSoftRemintNavigation({
      cookiePresent: true,
      priorClaims: null,
    });
    assert.equal(d.action, "fail_closed_reembed");
    if (d.action === "fail_closed_reembed") {
      assert.equal(d.reason, "PRIOR_COOKIE_INVALID");
    }
  });

  it("soft-first (no cookie) still pre-NAV-G1 proceed without menus", () => {
    const d = decideSoftRemintNavigation({
      cookiePresent: false,
      priorClaims: null,
    });
    assert.equal(d.action, "proceed");
    if (d.action === "proceed") {
      assert.equal(d.menus, null);
      assert.equal(d.submenus, null);
      assert.equal(hasExplicitNavClaims(d.menus, d.submenus), false);
    }
  });

  it("8. management direct deep-link denied when management unchecked", () => {
    const selection = {
      menuIds: ["/policies", "/org"],
      submenuIds: { "/policies": ["/policies/review"] },
    };
    assert.equal(
      isPathAllowedByMenuSelection(
        "/policies/abc",
        selection,
        resolvePolicyMenuPath,
      ),
      false,
    );
    assert.equal(
      isPathAllowedByMenuSelection(
        "/org/heltes/h1/alba/a1/policies",
        selection,
        resolvePolicyMenuPath,
      ),
      false,
    );
    assert.equal(
      isPathAllowedByMenuSelection(
        "/policies/review",
        selection,
        resolvePolicyMenuPath,
      ),
      true,
    );
  });
});
