import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  authorizeNavigation,
  isNavG1Enforce,
} from "./nav-authorize";
import { setNavTelemetrySink, type NavTelemetryRecord } from "./nav-telemetry";
import {
  canAccessPolicyPath,
  firstAllowedPolicyPath,
  isPathAllowedByMenuSelection,
  resolvePolicyMenuPath,
} from "./menu-route-guard";
import {
  decideSoftRemintNavigation,
  hasExplicitNavClaims,
} from "./soft-remint-nav";

const events: NavTelemetryRecord[] = [];
setNavTelemetrySink((r) => events.push(r));
afterEach(() => {
  events.length = 0;
});

async function withG1<T>(value: string | undefined, fn: () => Promise<T> | T) {
  const prev = process.env.NAV_G1_ENFORCE;
  if (value === undefined) delete process.env.NAV_G1_ENFORCE;
  else process.env.NAV_G1_ENFORCE = value;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.NAV_G1_ENFORCE;
    else process.env.NAV_G1_ENFORCE = prev;
  }
}

const G_OFF = { g1: false } as const;
const G_ON = { g1: true } as const;

describe("N2 Policy: management vs review (submenu allow/deny)", () => {
  const reviewOnly = {
    menuIds: ["/policies"],
    submenuIds: { "/policies": ["/policies/review"] },
  };
  const mgmtOnly = {
    menuIds: ["/policies"],
    submenuIds: { "/policies": ["/policies"] },
  };

  it("review-only: review + preview allowed, management denied", () => {
    const ok = (p: string) =>
      isPathAllowedByMenuSelection(p, reviewOnly, resolvePolicyMenuPath, G_OFF);
    assert.equal(ok("/policies/review"), true);
    assert.equal(ok("/policies/review/abc"), true);
    assert.equal(ok("/policies/p1/preview"), true);
    assert.equal(ok("/policies"), false);
    assert.equal(ok("/policies/p1"), false);
    assert.equal(ok("/clauses/c1"), false);
    assert.equal(ok("/org/heltes/h1/alba/a1/policies"), false);
  });

  it("management-only: management allowed, review denied", () => {
    const ok = (p: string) =>
      isPathAllowedByMenuSelection(p, mgmtOnly, resolvePolicyMenuPath, G_OFF);
    assert.equal(ok("/policies"), true);
    assert.equal(ok("/policies/p1"), true);
    assert.equal(ok("/policies/review"), false);
    assert.equal(ok("/policies/p1/preview"), false);
  });

  it("positions management/review submenu parity", () => {
    const sel = {
      menuIds: ["/positions"],
      submenuIds: { "/positions": ["/positions/review"] },
    };
    const ok = (p: string) =>
      isPathAllowedByMenuSelection(p, sel, resolvePolicyMenuPath, G_OFF);
    assert.equal(ok("/positions/review"), true);
    assert.equal(ok("/positions"), false);
  });

  it("menu not granted → deny; unmapped route with config → deny", () => {
    const sel = { menuIds: ["/dashboard"], submenuIds: null };
    const ok = (p: string) =>
      isPathAllowedByMenuSelection(p, sel, resolvePolicyMenuPath, G_OFF);
    assert.equal(ok("/dashboard"), true);
    assert.equal(ok("/policies"), false);
    assert.equal(ok("/my"), false); // resolver returns null → unmapped
    assert.equal(ok("/totally/unknown"), false);
  });

  it("submenus-only config (menuIds null) still enforces submenu list", () => {
    const sel = { menuIds: null, submenuIds: { "/policies": ["/policies/review"] } };
    assert.equal(isPathAllowedByMenuSelection("/policies", sel, resolvePolicyMenuPath, G_OFF), false);
    assert.equal(isPathAllowedByMenuSelection("/policies/review", sel, resolvePolicyMenuPath, G_OFF), true);
  });

  it("firstAllowedPolicyPath lands on an allowed review route (no redirect loop)", () => {
    assert.equal(firstAllowedPolicyPath(reviewOnly), "/policies/review");
  });
});

describe("N2/N6 Policy: missing config pre-G1 vs post-G1", () => {
  const none = { menuIds: null, submenuIds: null };

  it("pre-G1: no config → compat allow (+ nav.compat_allow)", () => {
    assert.equal(
      isPathAllowedByMenuSelection("/policies", none, resolvePolicyMenuPath, {
        ...G_OFF,
        emit: true,
      }),
      true,
    );
    assert.equal(events[0]?.event, "nav.compat_allow");
  });

  it("post-G1: no config → deny (+ nav.config_missing)", () => {
    assert.equal(
      isPathAllowedByMenuSelection("/policies", none, resolvePolicyMenuPath, {
        ...G_ON,
        emit: true,
      }),
      false,
    );
    assert.equal(events[0]?.event, "nav.config_missing");
  });

  it("env drives the default; UI filter canAccessPolicyPath ignores the flag", async () => {
    await withG1("1", () => {
      assert.equal(isNavG1Enforce(), true);
      assert.equal(
        isPathAllowedByMenuSelection("/policies", none, resolvePolicyMenuPath),
        false,
      );
      assert.equal(canAccessPolicyPath("/policies", null, null), true); // UI only
    });
    await withG1(undefined, () => {
      assert.equal(isNavG1Enforce(), false);
      assert.equal(
        isPathAllowedByMenuSelection("/policies", none, resolvePolicyMenuPath),
        true,
      );
    });
  });

  it("expired / invalid token states deny with reembed (contract)", () => {
    for (const tokenState of ["expired", "invalid"] as const) {
      const d = authorizeNavigation({
        moduleId: "policy-compliance",
        pathname: "/policies",
        selection: { menuIds: ["/policies"], submenuIds: null },
        resolve: resolvePolicyMenuPath,
        tokenState,
        g1: false,
        emit: false,
      });
      assert.equal(d.allow, false);
      if (!d.allow) assert.equal(d.action, "reembed");
    }
  });
});

describe("N2/N6 Policy soft-remint under G1", () => {
  it("pre-G1: soft-first (no cookie) proceeds without menus", () => {
    const d = decideSoftRemintNavigation({ cookiePresent: false, priorClaims: null, g1: false });
    assert.equal(d.action, "proceed");
  });

  it("G1: soft-first (no cookie) → fail closed NAV_CONFIG_MISSING", () => {
    const d = decideSoftRemintNavigation({ cookiePresent: false, priorClaims: null, g1: true });
    assert.equal(d.action, "fail_closed_reembed");
    if (d.action === "fail_closed_reembed") assert.equal(d.reason, "NAV_CONFIG_MISSING");
  });

  it("G1: prior claims without nav menus/submenus → fail closed", () => {
    const d = decideSoftRemintNavigation({
      cookiePresent: true,
      priorClaims: { menus: null, submenus: null },
      g1: true,
    });
    assert.equal(d.action, "fail_closed_reembed");
    // pre-G1 the same claims proceed (compat)
    assert.equal(
      decideSoftRemintNavigation({
        cookiePresent: true,
        priorClaims: { menus: null, submenus: null },
        g1: false,
      }).action,
      "proceed",
    );
  });

  it("G1: prior claims WITH nav claims are preserved (valid path)", () => {
    const d = decideSoftRemintNavigation({
      cookiePresent: true,
      priorClaims: { menus: ["/policies"], submenus: { "/policies": ["/policies/review"] } },
      g1: true,
    });
    assert.equal(d.action, "proceed");
    if (d.action === "proceed") {
      assert.equal(hasExplicitNavClaims(d.menus, d.submenus), true);
      assert.deepEqual(d.menus, ["/policies"]);
    }
  });

  it("prior cookie unverifiable stays PRIOR_COOKIE_INVALID regardless of flag", () => {
    for (const g1 of [false, true]) {
      const d = decideSoftRemintNavigation({ cookiePresent: true, priorClaims: null, g1 });
      assert.equal(d.action, "fail_closed_reembed");
      if (d.action === "fail_closed_reembed") assert.equal(d.reason, "PRIOR_COOKIE_INVALID");
    }
  });

  it("malformed prior menus treated as absent (preserve path) and fail closed under G1", () => {
    const d = decideSoftRemintNavigation({
      cookiePresent: true,
      priorClaims: { menus: "bad" as unknown, submenus: 5 as unknown },
      g1: true,
    });
    assert.equal(d.action, "fail_closed_reembed");
  });
});
