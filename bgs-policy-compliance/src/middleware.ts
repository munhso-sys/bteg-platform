import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  POLICY_SCOPE_COOKIE,
  signPolicyEmbedToken,
  verifyPolicyEmbedToken,
  type PolicyEmbedClaims,
} from "@/lib/access/embed";
import {
  firstAllowedPolicyPath,
  isPathAllowedByMenuSelection,
  resolvePolicyMenuPath,
  type MenuRouteSelection,
} from "@/lib/access/menu-route-guard";
import {
  decideSoftRemintNavigation,
  hasExplicitNavClaims,
} from "@/lib/access/soft-remint-nav";
import { isNavG1Enforce } from "@/lib/access/nav-authorize";
import { emitNavEvent } from "@/lib/access/nav-telemetry";

function allowedForPosition(pathname: string, positionId: string | null) {
  if (pathname === "/my") return true;
  if (positionId && pathname === `/positions/${positionId}`) return true;
  if (
    positionId &&
    pathname === `/positions/${encodeURIComponent(positionId)}`
  ) {
    return true;
  }
  if (/^\/policies\/[^/]+$/.test(pathname)) return true;
  if (/^\/clauses\/[^/]+$/.test(pathname)) return true;
  return false;
}

function allowedForUnit(
  pathname: string,
  heltesId: string | null | undefined,
  albaId: string | null | undefined,
) {
  if (pathname === "/dashboard") return true;
  if (pathname === "/org") return true;
  if (pathname === "/policies") return true;
  if (pathname === "/positions") return true;
  if (pathname === "/matrix") return true;
  if (pathname === "/evaluations") return true;
  if (/^\/policies\/[^/]+$/.test(pathname)) return true;
  if (/^\/clauses\/[^/]+$/.test(pathname)) return true;
  if (/^\/positions\/[^/]+$/.test(pathname)) return true;
  if (heltesId && pathname.startsWith(`/org/heltes/${heltesId}`)) return true;
  if (
    heltesId &&
    albaId &&
    pathname.startsWith(`/org/heltes/${heltesId}/alba/${albaId}`)
  ) {
    return true;
  }
  // Block other heltes branches
  if (pathname.startsWith("/org/heltes/")) {
    if (!heltesId) return false;
    return pathname.startsWith(`/org/heltes/${heltesId}`);
  }
  return false;
}

/**
 * Scope cookie is HttpOnly, Secure, SameSite=None so the portal iframe can
 * carry it (third-party context). Do NOT weaken `secure` in production/hosted
 * runtimes; relax only for a verified non-hosted local runtime if ever needed.
 */
function scopeCookieOptions(maxAge = 12 * 60 * 60) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
    maxAge,
  };
}

function clearSoftParams(url: URL) {
  for (const key of [
    "embed",
    "scope",
    "position_id",
    "position_name",
    "heltes_id",
    "alba_id",
    "heltes_name",
    "alba_name",
  ]) {
    url.searchParams.delete(key);
  }
}

async function claimsFromSoftParams(
  request: NextRequest,
): Promise<PolicyEmbedClaims | null> {
  const scope = request.nextUrl.searchParams.get("scope");
  if (scope !== "position" && scope !== "unit" && scope !== "view") return null;
  return {
    v: 1,
    uid: "soft",
    role: null,
    positionId: request.nextUrl.searchParams.get("position_id"),
    positionName: request.nextUrl.searchParams.get("position_name"),
    heltesId: request.nextUrl.searchParams.get("heltes_id"),
    albaId: request.nextUrl.searchParams.get("alba_id"),
    heltesName: request.nextUrl.searchParams.get("heltes_name"),
    albaName: request.nextUrl.searchParams.get("alba_name"),
    mode: scope,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", url.pathname);

  const embed = url.searchParams.get("embed");
  let claims = embed ? await verifyPolicyEmbedToken(embed) : null;

  if (!claims) {
    const soft = await claimsFromSoftParams(request);
    if (soft) {
      // Preserve menu allowlists from an existing cookie when soft-scoping.
      // N1-03 Choice A: cookie present but unverifiable → fail closed / re-embed.
      const cookieVal = request.cookies.get(POLICY_SCOPE_COOKIE)?.value;
      const prior = cookieVal
        ? await verifyPolicyEmbedToken(cookieVal)
        : null;
      const navDecision = decideSoftRemintNavigation({
        cookiePresent: Boolean(cookieVal),
        priorClaims: prior,
      });
      if (navDecision.action === "fail_closed_reembed") {
        emitNavEvent(
          navDecision.reason === "NAV_CONFIG_MISSING"
            ? "nav.config_missing"
            : "nav.token_invalid",
          {
            moduleId: "policy-compliance",
            path: url.pathname,
            reason: navDecision.reason,
            source: "soft-remint",
            g1: isNavG1Enforce(),
          },
        );
        clearSoftParams(url);
        const dest = new URL("/dashboard", request.url);
        dest.searchParams.set("nav_reembed", "1");
        const res = NextResponse.redirect(dest);
        res.cookies.delete(POLICY_SCOPE_COOKIE);
        return res;
      }
      const signed = await signPolicyEmbedToken({
        uid: soft.uid,
        role: soft.role,
        positionId: soft.positionId,
        positionName: soft.positionName,
        heltesId: soft.heltesId,
        albaId: soft.albaId,
        heltesName: soft.heltesName,
        albaName: soft.albaName,
        mode: soft.mode,
        menus: navDecision.menus,
        submenus: navDecision.submenus,
        exp: soft.exp,
      });
      if (signed) {
        claims = {
          ...soft,
          menus: navDecision.menus,
          submenus: navDecision.submenus,
        };
        clearSoftParams(url);
        const res = NextResponse.redirect(url);
        res.cookies.set(POLICY_SCOPE_COOKIE, signed, scopeCookieOptions());
        return res;
      }
    }
  }

  if (embed && claims) {
    clearSoftParams(url);
    const res = NextResponse.redirect(url);
    res.cookies.set(POLICY_SCOPE_COOKIE, embed, scopeCookieOptions());
    return res;
  }

  claims =
    claims ||
    (await verifyPolicyEmbedToken(
      request.cookies.get(POLICY_SCOPE_COOKIE)?.value,
    ));

  if (claims?.mode === "position") {
    if (!allowedForPosition(url.pathname, claims.positionId)) {
      const dest = claims.positionId
        ? `/positions/${claims.positionId}`
        : "/my";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  if (claims?.mode === "unit") {
    if (!allowedForUnit(url.pathname, claims.heltesId, claims.albaId)) {
      const dest =
        claims.heltesId && claims.albaId
          ? `/org/heltes/${claims.heltesId}/alba/${claims.albaId}`
          : claims.heltesId
            ? `/org/heltes/${claims.heltesId}`
            : "/org";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  // `/my` is not a Role эрх catalog id — exempt only for mode=position.
  // mode=view uses Role эрх menus for reachability (no workplace /my gate).
  const isPositionHome =
    claims?.mode === "position" &&
    (url.pathname === "/my" || url.pathname.startsWith("/my/"));

  // Role эрх sidebar allowlist — fail closed for deep links (org, workplace, etc.)
  if (
    claims &&
    !isPositionHome &&
    hasExplicitNavClaims(claims.menus, claims.submenus)
  ) {
    const selection: MenuRouteSelection = {
      menuIds: Array.isArray(claims.menus) ? claims.menus : null,
      submenuIds:
        claims.submenus && typeof claims.submenus === "object"
          ? claims.submenus
          : null,
    };
    if (
      !isPathAllowedByMenuSelection(
        url.pathname,
        selection,
        resolvePolicyMenuPath,
        { emit: true, source: "middleware" },
      )
    ) {
      const dest = firstAllowedPolicyPath(selection);
      return NextResponse.redirect(new URL(dest, request.url));
    }
  } else if (isNavG1Enforce() && !isPositionHome) {
    // NAV_G1_ENFORCE=1: no signed nav claims (no cookie, or claims without
    // menus/submenus) → fail closed instead of compat allow.
    emitNavEvent("nav.config_missing", {
      moduleId: "policy-compliance",
      path: url.pathname,
      reason: "no_signed_nav_claims",
      source: "middleware",
      g1: true,
    });
    if (url.searchParams.get("nav_reembed") === "1") {
      // Already bounced once → stop (avoid redirect loop).
      return new NextResponse(
        "Navigation grant required. Re-open this module from the portal.",
        { status: 403 },
      );
    }
    const dest = new URL("/dashboard", request.url);
    dest.searchParams.set("nav_reembed", "1");
    const res = NextResponse.redirect(dest);
    res.cookies.delete(POLICY_SCOPE_COOKIE);
    return res;
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
