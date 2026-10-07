import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { authorizeNavigation, isNavG1Enforce } from "./nav-authorize";
import { setNavTelemetrySink, type NavTelemetryRecord } from "./nav-telemetry";
import {
  firstAllowedInspectionPath,
  isPathAllowedByMenuSelection,
  resolveInspectionMenuPath,
} from "./menu-route-guard";
import {
  decideInspectionAdminAccess,
  decideInspectionWriteAccess,
} from "./write-access";
import type { InspectionEmbedClaims } from "./embed";

const events: NavTelemetryRecord[] = [];
setNavTelemetrySink((r) => events.push(r));
afterEach(() => {
  events.length = 0;
});

const local = { NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv;
const hosted = { NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv;

function claims(
  partial: Partial<InspectionEmbedClaims> & Pick<InspectionEmbedClaims, "mode">,
): InspectionEmbedClaims {
  return {
    v: 1,
    uid: "u1",
    role: partial.role ?? "inspector",
    heltesId: null,
    albaId: null,
    heltesName: null,
    albaName: null,
    mode: partial.mode,
    menus: partial.menus,
    submenus: partial.submenus,
    exp: Date.now() + 60_000,
  };
}

/** Navigation decision for a signed scope, as middleware computes it. */
function navAllowed(scope: InspectionEmbedClaims, pathname: string, g1 = false) {
  return isPathAllowedByMenuSelection(
    pathname,
    {
      menuIds: Array.isArray(scope.menus) ? scope.menus : null,
      submenuIds: scope.submenus ?? null,
    },
    resolveInspectionMenuPath,
    { g1 },
  );
}

describe("N2 Inspection navigation (menu/submenu)", () => {
  const sel = {
    menuIds: ["/findings", "/dashboard"],
    submenuIds: { "/findings": ["/findings/state"] },
  };
  const ok = (p: string, g1 = false) =>
    isPathAllowedByMenuSelection(p, sel, resolveInspectionMenuPath, { g1 });

  it("allow menu + allowed submenu; deny sibling submenu, other menus, unmapped", () => {
    assert.equal(ok("/dashboard"), true);
    assert.equal(ok("/findings/state"), true);
    assert.equal(ok("/findings/night"), false);
    assert.equal(ok("/findings"), false);
    assert.equal(ok("/plans"), false);
    assert.equal(ok("/unknown-surface"), false);
  });

  it("firstAllowedInspectionPath never returns a denied path", () => {
    const first = firstAllowedInspectionPath(sel);
    assert.equal(ok(first), true);
  });

  it("pre-G1 no config → compat allow; post-G1 → deny + config_missing", () => {
    const none = { menuIds: null, submenuIds: null };
    assert.equal(
      isPathAllowedByMenuSelection("/runs", none, resolveInspectionMenuPath, {
        g1: false,
        emit: true,
      }),
      true,
    );
    assert.equal(
      isPathAllowedByMenuSelection("/runs", none, resolveInspectionMenuPath, {
        g1: true,
        emit: true,
      }),
      false,
    );
    assert.deepEqual(
      events.map((e) => e.event),
      ["nav.compat_allow", "nav.config_missing"],
    );
  });

  it("env flag default off", () => {
    const prev = process.env.NAV_G1_ENFORCE;
    delete process.env.NAV_G1_ENFORCE;
    try {
      assert.equal(isNavG1Enforce(), false);
      process.env.NAV_G1_ENFORCE = "1";
      assert.equal(isNavG1Enforce(), true);
    } finally {
      if (prev === undefined) delete process.env.NAV_G1_ENFORCE;
      else process.env.NAV_G1_ENFORCE = prev;
    }
  });

  it("contract: expired/invalid embed → deny + reembed", () => {
    for (const tokenState of ["expired", "invalid"] as const) {
      const d = authorizeNavigation({
        moduleId: "inspection",
        pathname: "/dashboard",
        selection: sel,
        resolve: resolveInspectionMenuPath,
        tokenState,
        g1: false,
        emit: false,
      });
      assert.equal(d.allow, false);
    }
  });
});

describe("N2 Inspection write-mode permission control (nav ≠ write)", () => {
  it("view-only role may NAVIGATE an allowed menu but cannot WRITE", () => {
    const view = claims({
      mode: "view",
      role: "dxsh_specialist",
      menus: ["/findings"],
      submenus: null,
    });
    assert.equal(navAllowed(view, "/findings"), true);
    const w = decideInspectionWriteAccess(view, local);
    assert.equal(w.allow, false);
    if (!w.allow) assert.equal(w.reason, "view_readonly");
  });

  it("unit scope may navigate allowed menu but write is read-only", () => {
    const unit = claims({ mode: "unit", role: "manager", menus: ["/findings"] });
    assert.equal(navAllowed(unit, "/findings"), true);
    const w = decideInspectionWriteAccess(unit, local);
    assert.equal(w.allow, false);
    if (!w.allow) assert.equal(w.reason, "unit_readonly");
  });

  it("full inspector: nav allow + write allow; denied menu stays denied for navigation only", () => {
    const inspector = claims({ mode: "full", role: "inspector", menus: ["/findings"] });
    assert.equal(navAllowed(inspector, "/findings"), true);
    assert.equal(navAllowed(inspector, "/settings"), false);
    assert.equal(decideInspectionWriteAccess(inspector, hosted).allow, true);
  });

  it("admin ops still require admin role regardless of menu allowlist", () => {
    const manager = claims({ mode: "full", role: "manager", menus: ["/settings"] });
    assert.equal(navAllowed(manager, "/settings"), true);
    const d = decideInspectionAdminAccess(manager, hosted);
    assert.equal(d.allow, false);
    if (!d.allow) assert.equal(d.reason, "not_admin");
    const admin = claims({ mode: "full", role: "admin", menus: ["/settings"] });
    assert.equal(decideInspectionAdminAccess(admin, hosted).allow, true);
  });

  it("missing scope on hosted: write denied; nav under G1 denied (no config)", () => {
    assert.equal(decideInspectionWriteAccess(null, hosted).allow, false);
    assert.equal(
      isPathAllowedByMenuSelection(
        "/dashboard",
        { menuIds: null, submenuIds: null },
        resolveInspectionMenuPath,
        { g1: true },
      ),
      false,
    );
  });

  it("claims with no nav menus: pre-G1 nav allowed but write mode still gates writes", () => {
    const view = claims({ mode: "view", role: "dxsh_specialist" });
    assert.equal(navAllowed(view, "/dashboard", false), true);
    assert.equal(navAllowed(view, "/dashboard", true), false);
    assert.equal(decideInspectionWriteAccess(view, local).allow, false);
  });
});
