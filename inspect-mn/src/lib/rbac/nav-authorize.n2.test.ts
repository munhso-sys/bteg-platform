import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  authorizeNavigation,
  isNavG1Enforce,
  type NavResolvedPath,
} from "./nav-authorize";
import {
  emitNavEvent,
  setNavTelemetrySink,
  type NavTelemetryRecord,
} from "./nav-telemetry";
import {
  isPathAllowedByMenuSelection,
  resolveGuidanceMenuPath,
  resolvePortalTopMenuPath,
  resolveReportMenuPath,
  resolveRiskMenuPath,
  resolveVoiceMenuPath,
} from "./menu-route-guard";
import {
  MODULE_MENU_CATALOG,
  NAV_MENU_CATALOG_VERSION,
  getModuleMenuCatalog,
} from "./module-menus";
import {
  inspectModuleNavGrant,
  signModuleNavGrant,
  verifyModuleNavGrant,
} from "./nav-grant";
// Cross-module interop: portal-signed grants must verify in the Process app.
import {
  inspectModuleNavGrant as processInspect,
  isProcessPathAllowed,
} from "../../../../process/src/lib/access/nav-grant";
import { isDevelopmentPathAllowed } from "../../../../development/src/lib/access/nav-grant";

const events: NavTelemetryRecord[] = [];
setNavTelemetrySink((r) => events.push(r));
afterEach(() => {
  events.length = 0;
});

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function hand(secret: string, payload: unknown) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

async function withEnv<T>(
  patch: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const resolveDemo = (p: string): NavResolvedPath | null => {
  if (p.startsWith("/plans/annual")) {
    return { menuId: "/plans", submenuId: "/plans/annual" };
  }
  if (p.startsWith("/plans")) return { menuId: "/plans", submenuId: "/plans" };
  if (p.startsWith("/runs")) return { menuId: "/runs" };
  return null;
};

describe("N2 authorizeNavigation contract", () => {
  const base = { moduleId: "demo", resolve: resolveDemo, emit: false } as const;

  it("allow: config + allowlisted menu", () => {
    const d = authorizeNavigation({
      ...base,
      pathname: "/runs",
      selection: { menuIds: ["/runs"], submenuIds: {} },
      g1: false,
    });
    assert.deepEqual(d, { allow: true, reason: "allowed", menuId: "/runs" });
  });

  it("deny: config + menu not allowlisted", () => {
    const d = authorizeNavigation({
      ...base,
      pathname: "/runs",
      selection: { menuIds: ["/plans"], submenuIds: {} },
      g1: false,
    });
    assert.equal(d.allow, false);
    if (!d.allow) assert.equal(d.reason, "menu_denied");
  });

  it("submenu: allowed child vs denied child", () => {
    const selection = {
      menuIds: ["/plans"],
      submenuIds: { "/plans": ["/plans"] },
    };
    const ok = authorizeNavigation({
      ...base,
      pathname: "/plans",
      selection,
      g1: false,
    });
    const denied = authorizeNavigation({
      ...base,
      pathname: "/plans/annual",
      selection,
      g1: false,
    });
    assert.equal(ok.allow, true);
    assert.equal(denied.allow, false);
    if (!denied.allow) assert.equal(denied.reason, "submenu_denied");
  });

  it("submenu: parent without explicit submenu list allows every child", () => {
    const d = authorizeNavigation({
      ...base,
      pathname: "/plans/annual",
      selection: { menuIds: ["/plans"], submenuIds: {} },
      g1: false,
    });
    assert.equal(d.allow, true);
  });

  it("unmapped route + config → deny route_unmapped", () => {
    const d = authorizeNavigation({
      ...base,
      pathname: "/mystery",
      selection: { menuIds: ["/plans"], submenuIds: {} },
      g1: false,
    });
    assert.equal(d.allow, false);
    if (!d.allow) {
      assert.equal(d.reason, "route_unmapped");
      assert.equal(d.action, "deny");
    }
  });

  it("malformed selection → deny (never no-config compat allow)", () => {
    for (const bad of [
      { menuIds: "nope" },
      { menuIds: {} },
      { menuIds: ["/runs"], submenuIds: ["x"] },
      { submenuIds: "x" },
    ]) {
      const d = authorizeNavigation({
        ...base,
        pathname: "/runs",
        selection: bad as never,
        g1: false,
      });
      assert.equal(d.allow, false, JSON.stringify(bad));
      if (!d.allow) assert.equal(d.reason, "selection_malformed");
    }
  });

  it("token expired / invalid → deny + reembed even when selection present", () => {
    const sel = { menuIds: ["/runs"], submenuIds: {} };
    for (const state of ["expired", "invalid"] as const) {
      const d = authorizeNavigation({
        ...base,
        pathname: "/runs",
        selection: sel,
        tokenState: state,
        g1: false,
      });
      assert.equal(d.allow, false);
      if (!d.allow) {
        assert.equal(d.reason, `token_${state}`);
        assert.equal(d.action, "reembed");
      }
    }
  });

  it("missing config pre-G1 → compat allow", () => {
    for (const selection of [null, undefined, {}, { menuIds: null, submenuIds: null }]) {
      const d = authorizeNavigation({
        ...base,
        pathname: "/anything",
        selection,
        g1: false,
      });
      assert.deepEqual(d, { allow: true, reason: "compat_allow" });
    }
  });

  it("missing config post-G1 → fail closed (config_missing)", () => {
    const d = authorizeNavigation({
      ...base,
      pathname: "/runs",
      selection: null,
      g1: true,
    });
    assert.equal(d.allow, false);
    if (!d.allow) {
      assert.equal(d.reason, "config_missing");
      assert.equal(d.action, "reembed");
    }
  });

  it("enforce marker (prior enforced session) denies even pre-G1", () => {
    const d = authorizeNavigation({
      ...base,
      pathname: "/runs",
      selection: null,
      enforceMarker: true,
      g1: false,
    });
    assert.equal(d.allow, false);
  });

  it("G1 does not break valid config allow", () => {
    const d = authorizeNavigation({
      ...base,
      pathname: "/runs",
      selection: { menuIds: ["/runs"], submenuIds: {} },
      g1: true,
    });
    assert.equal(d.allow, true);
  });
});

describe("N6 NAV_G1_ENFORCE flag (default OFF, env-driven)", () => {
  it("is off unless exactly '1'", async () => {
    await withEnv({ NAV_G1_ENFORCE: undefined }, () =>
      assert.equal(isNavG1Enforce(), false),
    );
    for (const v of ["0", "true", "yes", ""]) {
      await withEnv({ NAV_G1_ENFORCE: v }, () =>
        assert.equal(isNavG1Enforce(), false, v),
      );
    }
    await withEnv({ NAV_G1_ENFORCE: "1" }, () =>
      assert.equal(isNavG1Enforce(), true),
    );
    assert.equal(isNavG1Enforce({ NAV_G1_ENFORCE: "1" }), true);
    assert.equal(isNavG1Enforce({}), false);
  });

  it("portal guard follows env: null config allow → deny when flag on", async () => {
    await withEnv({ NAV_G1_ENFORCE: undefined }, () =>
      assert.equal(
        isPathAllowedByMenuSelection("/inspection", null, resolvePortalTopMenuPath),
        true,
      ),
    );
    await withEnv({ NAV_G1_ENFORCE: "1" }, () => {
      assert.equal(
        isPathAllowedByMenuSelection("/inspection", null, resolvePortalTopMenuPath),
        false,
      );
      assert.equal(
        isPathAllowedByMenuSelection(
          "/inspection",
          { menuIds: ["inspection"], submenuIds: {} },
          resolvePortalTopMenuPath,
        ),
        true,
      );
    });
  });
});

describe("N5 telemetry", () => {
  it("emits compat_allow pre-G1 and config_missing post-G1", () => {
    isPathAllowedByMenuSelection("/inspection", null, resolvePortalTopMenuPath, {
      g1: false,
    });
    isPathAllowedByMenuSelection("/inspection", null, resolvePortalTopMenuPath, {
      g1: true,
    });
    assert.deepEqual(
      events.map((e) => e.event),
      ["nav.compat_allow", "nav.config_missing"],
    );
    assert.equal(events[1]?.g1, true);
  });

  it("maps decisions to allow / deny / route_unmapped / token events", () => {
    const sel = { menuIds: ["/risk-management"], submenuIds: {} };
    isPathAllowedByMenuSelection("/risk-management", sel, resolveRiskMenuPath, { g1: false });
    isPathAllowedByMenuSelection("/risk-management/matrix", sel, resolveRiskMenuPath, { g1: false });
    isPathAllowedByMenuSelection("/elsewhere", sel, resolveRiskMenuPath, { g1: false });
    authorizeNavigation({
      moduleId: "m",
      pathname: "/x",
      selection: sel,
      resolve: resolveRiskMenuPath,
      tokenState: "invalid",
    });
    authorizeNavigation({
      moduleId: "m",
      pathname: "/x",
      selection: sel,
      resolve: resolveRiskMenuPath,
      tokenState: "expired",
    });
    assert.deepEqual(
      events.map((e) => e.event),
      [
        "nav.allow",
        "nav.deny",
        "nav.route_unmapped",
        "nav.token_invalid",
        "nav.token_expired",
      ],
    );
  });

  it("never logs tokens/secrets: query stripped, unknown fields dropped", () => {
    emitNavEvent("nav.deny", {
      moduleId: "process",
      path: "/dashboard?nav=SECRET.TOKEN&embed=ALSO.SECRET#frag",
      token: "SECRET.TOKEN",
      secret: "hunter2",
      cookie: "process_nav_grant=SECRET",
    } as never);
    const rec = events[0]!;
    assert.equal(rec.path, "/dashboard");
    const dump = JSON.stringify(rec);
    for (const leak of ["SECRET", "hunter2", "embed=", "nav="]) {
      assert.equal(dump.includes(leak), false, leak);
    }
  });

  it("a throwing sink never breaks authorization", () => {
    setNavTelemetrySink(() => {
      throw new Error("sink down");
    });
    try {
      assert.doesNotThrow(() =>
        isPathAllowedByMenuSelection("/inspection", null, resolvePortalTopMenuPath, {
          g1: false,
        }),
      );
    } finally {
      setNavTelemetrySink((r) => events.push(r));
    }
  });
});

describe("N3 reports parity (ReportsNav ↔ catalog ↔ resolver)", () => {
  const navSource = readFileSync(
    path.join(process.cwd(), "src/components/reports/ReportsNav.tsx"),
    "utf8",
  );
  const tabHrefs = [...navSource.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]!);

  it("ReportsNav tabs are discovered", () => {
    assert.ok(tabHrefs.length >= 7, tabHrefs.join(","));
    assert.ok(tabHrefs.every((h) => h.startsWith("/report-analysis")));
  });

  it("catalog report-analysis children match ReportsNav routes exactly", () => {
    const entry = getModuleMenuCatalog("report-analysis");
    assert.ok(entry);
    const parent = entry.menus.find((m) => m.id === "/report-analysis");
    assert.ok(parent?.children);
    assert.deepEqual(
      parent.children.map((c) => c.id).sort(),
      [...tabHrefs].sort(),
    );
  });

  it("resolveReportMenuPath maps every tab (and nested paths) to its child", () => {
    for (const href of tabHrefs) {
      assert.deepEqual(resolveReportMenuPath(href), {
        menuId: "/report-analysis",
        submenuId: href,
      });
      if (href !== "/report-analysis") {
        assert.equal(
          resolveReportMenuPath(`${href}/deep/path?x=1`)?.submenuId,
          href,
        );
      }
    }
    assert.equal(resolveReportMenuPath("/risk-management"), null);
    assert.equal(resolveReportMenuPath("/report-analysisX"), null);
  });

  it("report access: menu-only config (legacy v1) allows all tabs", () => {
    const sel = { menuIds: ["/report-analysis"], submenuIds: {} };
    for (const href of tabHrefs) {
      assert.equal(
        isPathAllowedByMenuSelection(href, sel, resolveReportMenuPath, { g1: false }),
        true,
        href,
      );
    }
  });

  it("report access: submenu allowlist denies unchecked tabs, denies unmapped", () => {
    const sel = {
      menuIds: ["/report-analysis"],
      submenuIds: { "/report-analysis": ["/report-analysis/kpis"] },
    };
    const g = { g1: false };
    assert.equal(isPathAllowedByMenuSelection("/report-analysis/kpis", sel, resolveReportMenuPath, g), true);
    assert.equal(isPathAllowedByMenuSelection("/report-analysis/exports", sel, resolveReportMenuPath, g), false);
    assert.equal(isPathAllowedByMenuSelection("/report-analysis", sel, resolveReportMenuPath, g), false);
    assert.equal(isPathAllowedByMenuSelection("/elsewhere", sel, resolveReportMenuPath, g), false);
  });

  it("report access: menu not granted → deny; no config pre/post G1", () => {
    assert.equal(
      isPathAllowedByMenuSelection(
        "/report-analysis/kpis",
        { menuIds: ["/other"], submenuIds: {} },
        resolveReportMenuPath,
        { g1: false },
      ),
      false,
    );
    assert.equal(
      isPathAllowedByMenuSelection("/report-analysis", null, resolveReportMenuPath, { g1: false }),
      true,
    );
    assert.equal(
      isPathAllowedByMenuSelection("/report-analysis", null, resolveReportMenuPath, { g1: true }),
      false,
    );
  });

  it("layout + assertPortalMenuAccess wire report-analysis", () => {
    const layout = readFileSync(
      path.join(process.cwd(), "src/app/report-analysis/layout.tsx"),
      "utf8",
    );
    assert.match(layout, /assertPortalMenuAccess\("report-analysis"\)/);
    const assertSrc = readFileSync(
      path.join(process.cwd(), "src/lib/rbac/assert-menu-access.ts"),
      "utf8",
    );
    assert.match(assertSrc, /case "report-analysis":\s*return resolveReportMenuPath/);
  });

  it("Risk / Voice / Guidance resolvers + layouts stay wired", () => {
    assert.deepEqual(resolveRiskMenuPath("/risk-management/matrix/x"), { menuId: "/risk-management/matrix" });
    assert.deepEqual(resolveVoiceMenuPath("/employee-voice/inbox/1"), { menuId: "/employee-voice/inbox" });
    assert.deepEqual(resolveGuidanceMenuPath("/guidance/other"), { menuId: "/guidance/other" });
    assert.equal(resolveRiskMenuPath("/guidance"), null);
    assert.equal(resolveVoiceMenuPath("/risk-management"), null);
    assert.equal(resolveGuidanceMenuPath("/employee-voice"), null);
    for (const [dir, key] of [
      ["risk-management", "risk-management"],
      ["employee-voice", "employee-voice"],
      ["guidance", "guidance"],
    ] as const) {
      const layout = readFileSync(
        path.join(process.cwd(), `src/app/${dir}/layout.tsx`),
        "utf8",
      );
      assert.ok(layout.includes(`assertPortalMenuAccess("${key}")`), dir);
    }
  });

  it("every catalog child of Risk/Voice/Guidance resolves back to its own menu id", () => {
    const resolvers = {
      "risk-management": resolveRiskMenuPath,
      "employee-voice": resolveVoiceMenuPath,
      guidance: resolveGuidanceMenuPath,
    } as const;
    for (const [moduleId, resolve] of Object.entries(resolvers)) {
      for (const menu of getModuleMenuCatalog(moduleId)!.menus) {
        assert.equal(resolve(menu.id)?.menuId, menu.id, `${moduleId} ${menu.id}`);
      }
    }
  });
});

describe("N3 portal unmapped deny / top-level route mapping", () => {
  it("every portal catalog menu id maps via resolvePortalTopMenuPath", () => {
    for (const menu of getModuleMenuCatalog("portal")!.menus) {
      assert.deepEqual(resolvePortalTopMenuPath(`/${menu.id}`), { menuId: menu.id });
      assert.deepEqual(resolvePortalTopMenuPath(`/${menu.id}/sub/page`), { menuId: menu.id });
    }
  });

  it("unmapped portal route with config → deny; prefix lookalikes unmapped", () => {
    const sel = { menuIds: ["inspection"], submenuIds: {} };
    assert.equal(resolvePortalTopMenuPath("/processes"), null);
    assert.equal(
      isPathAllowedByMenuSelection("/not-a-module", sel, resolvePortalTopMenuPath, { g1: false }),
      false,
    );
    assert.equal(
      isPathAllowedByMenuSelection("/processes", sel, resolvePortalTopMenuPath, { g1: false }),
      false,
    );
    assert.equal(events.at(-1)?.event, "nav.route_unmapped");
  });
});

describe("catalog versioning", () => {
  it("exports v1", () => {
    assert.equal(NAV_MENU_CATALOG_VERSION, "v1");
  });

  it("role-menus API returns catalogVersion (GET + PUT)", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/role-menus/route.ts"),
      "utf8",
    );
    assert.ok(src.includes("NAV_MENU_CATALOG_VERSION"));
    assert.equal((src.match(/catalogVersion: NAV_MENU_CATALOG_VERSION/g) ?? []).length, 2);
  });

  it("module catalog still uses v1 route hrefs", () => {
    for (const id of ["process", "development", "inspection", "policy-compliance"]) {
      for (const menu of getModuleMenuCatalog(id)!.menus) {
        assert.ok(menu.id.startsWith("/"), `${id} ${menu.id}`);
      }
    }
    assert.ok(MODULE_MENU_CATALOG.length > 0);
  });
});

describe("N4 signModuleNavGrant secrets + VALID grant paths", () => {
  const selection = { menuIds: ["/processes", "/dashboard"], submenuIds: {} };

  it("prefers PROCESS_NAV_SECRET for process over embed secrets", () => {
    const env = {
      PROCESS_NAV_SECRET: "process-secret",
      POLICY_EMBED_SECRET: "policy-secret",
      INSPECTION_EMBED_SECRET: "inspection-secret",
    };
    const token = signModuleNavGrant("process", selection, { env })!;
    assert.ok(token);
    const body = token.split(".")[0]!;
    const expected = b64url(createHmac("sha256", "process-secret").update(body).digest());
    assert.equal(token.split(".")[1], expected);
  });

  it("prefers DEVELOPMENT_NAV_SECRET for development; other modules ignore nav secrets", () => {
    const env = {
      DEVELOPMENT_NAV_SECRET: "dev-secret",
      PROCESS_NAV_SECRET: "process-secret",
      POLICY_EMBED_SECRET: "policy-secret",
    };
    const dev = signModuleNavGrant("development", selection, { env })!;
    assert.equal(
      dev.split(".")[1],
      b64url(createHmac("sha256", "dev-secret").update(dev.split(".")[0]!).digest()),
    );
    const other = signModuleNavGrant("other", selection, { env })!;
    assert.equal(
      other.split(".")[1],
      b64url(createHmac("sha256", "policy-secret").update(other.split(".")[0]!).digest()),
    );
  });

  it("falls back to embed secrets (rollout) when module nav secret is unset", () => {
    const a = signModuleNavGrant("process", selection, {
      env: { POLICY_EMBED_SECRET: "policy-secret" },
    })!;
    assert.equal(
      a.split(".")[1],
      b64url(createHmac("sha256", "policy-secret").update(a.split(".")[0]!).digest()),
    );
    const b = signModuleNavGrant("development", selection, {
      env: { INSPECTION_EMBED_SECRET: "inspection-secret" },
    })!;
    assert.equal(
      b.split(".")[1],
      b64url(createHmac("sha256", "inspection-secret").update(b.split(".")[0]!).digest()),
    );
  });

  it("no secret or no selection → null (never an unsigned token)", () => {
    assert.equal(signModuleNavGrant("process", selection, { env: {} }), null);
    assert.equal(
      signModuleNavGrant("process", null, { env: { PROCESS_NAV_SECRET: "s" } }),
      null,
    );
  });

  it("round trip: valid grant carries catalogVersion v1; wrong module / expired / tampered rejected", () => {
    const env = { PROCESS_NAV_SECRET: "process-secret" };
    const token = signModuleNavGrant("process", selection, { env })!;
    const ok = inspectModuleNavGrant(token, "process", env);
    assert.equal(ok.state, "valid");
    if (ok.state === "valid") {
      assert.equal(ok.grant.catalogVersion, "v1");
      assert.deepEqual(ok.grant.menuIds, selection.menuIds);
    }
    assert.equal(verifyModuleNavGrant(token, "development", env), null);

    const expired = signModuleNavGrant("process", selection, { env, ttlMs: -1000 })!;
    assert.equal(inspectModuleNavGrant(expired, "process", env).state, "expired");

    const [body, sig] = token.split(".");
    const tampered = `${b64url(
      JSON.stringify({ ...JSON.parse(Buffer.from(body!, "base64").toString()), menuIds: ["/settings"] }),
    )}.${sig}`;
    assert.equal(inspectModuleNavGrant(tampered, "process", env).state, "invalid");
    assert.equal(inspectModuleNavGrant("garbage", "process", env).state, "invalid");
    assert.equal(inspectModuleNavGrant(null, "process", env).state, "invalid");
  });

  it("portal-signed PROCESS_NAV_SECRET grant verifies in the Process app (VALID path)", async () => {
    await withEnv(
      {
        PROCESS_NAV_SECRET: "interop-process",
        POLICY_EMBED_SECRET: undefined,
        INSPECTION_EMBED_SECRET: undefined,
      },
      async () => {
        const token = signModuleNavGrant("process", selection)!;
        const r = await processInspect(token, "process");
        assert.equal(r.state, "valid");
        if (r.state === "valid") {
          assert.equal(r.grant.catalogVersion, "v1");
          assert.equal(isProcessPathAllowed("/processes", r.grant, false), true);
          assert.equal(isProcessPathAllowed("/documents", r.grant, false), false);
        }
        // A grant signed with an unrelated secret is INVALID in the module.
        const forged = hand("not-the-secret", {
          v: 1,
          moduleId: "process",
          menuIds: ["/processes"],
          submenuIds: {},
          exp: Date.now() + 60_000,
        });
        assert.equal((await processInspect(forged, "process")).state, "invalid");
      },
    );
  });

  it("DEVELOPMENT grant path: module allow/deny through isDevelopmentPathAllowed", () => {
    const grant = {
      v: 1 as const,
      moduleId: "development",
      menuIds: ["/projects"],
      submenuIds: {},
      exp: Date.now() + 1000,
    };
    assert.equal(isDevelopmentPathAllowed("/projects/1", grant, false), true);
    assert.equal(isDevelopmentPathAllowed("/settings", grant, false), false);
    assert.equal(isDevelopmentPathAllowed("/projects", null, false), true);
    assert.equal(isDevelopmentPathAllowed("/projects", null, true), false);
  });
});

describe("N2 drift guard: mirrored nav-authorize / nav-telemetry are identical", () => {
  const canonicalDir = path.join(process.cwd(), "src/lib/rbac");
  const mirrors = [
    "../bgs-policy-compliance/src/lib/access",
    "../inspection-center/src/lib/access",
    "../process/src/lib/access",
    "../development/src/lib/access",
  ];
  for (const file of ["nav-authorize.ts", "nav-telemetry.ts"]) {
    const canonical = readFileSync(path.join(canonicalDir, file), "utf8");
    for (const dir of mirrors) {
      it(`${dir}/${file} matches canonical`, () => {
        const copy = readFileSync(path.join(process.cwd(), dir, file), "utf8");
        assert.equal(copy, canonical);
      });
    }
  }
});

describe("admin bypass docs (OD-10)", () => {
  it("assert-menu-access states bypass does not skip permission checks", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/lib/rbac/assert-menu-access.ts"),
      "utf8",
    );
    assert.match(src, /OD-10/);
    assert.match(src, /does NOT skip any other check/i);
  });
});
