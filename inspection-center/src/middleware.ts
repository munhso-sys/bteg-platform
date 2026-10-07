import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  INSPECTION_SCOPE_COOKIE,
  INSPECTION_EMBED_HEADER,
  type InspectionEmbedClaims,
} from "@/lib/access/embed";
import { resolveInspectionEmbedFromParts } from "@/lib/access/embed-resolve";
import { isNavG1Enforce } from "@/lib/access/nav-authorize";
import { emitNavEvent } from "@/lib/access/nav-telemetry";
import {
  firstAllowedInspectionPath,
  isPathAllowedByMenuSelection,
  type MenuRouteSelection,
} from "@/lib/access/menu-route-guard";

function navConfigMissing(pathname: string, reason: string) {
  emitNavEvent("nav.config_missing", {
    moduleId: "inspection",
    path: pathname,
    reason,
    source: "middleware",
    g1: true,
  });
  return new NextResponse(
    "Navigation grant required. Re-open this module from the portal.",
    { status: 403 },
  );
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

function allowedForUnit(pathname: string) {
  if (pathname === "/dashboard") return true;
  if (pathname === "/findings" || pathname.startsWith("/findings/")) return true;
  if (pathname === "/actions" || pathname.startsWith("/actions/")) return true;
  if (pathname === "/runs/new") return false;
  if (pathname === "/runs" || pathname.startsWith("/runs/")) return true;
  if (pathname === "/plans" || pathname.startsWith("/plans/")) return true;
  if (pathname === "/analytics") return true;
  if (pathname === "/evidence") return true;
  return false;
}

function withEmbedHeader(request: NextRequest, token: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(INSPECTION_EMBED_HEADER, token);
  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.cookies.set(INSPECTION_SCOPE_COOKIE, token, scopeCookieOptions());
  return res;
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const embedParam = url.searchParams.get("embed");
  const cookieToken = request.cookies.get(INSPECTION_SCOPE_COOKIE)?.value ?? null;

  // IC-D01: do not mint signed tokens from unsigned scope=unit query params.
  const resolved = await resolveInspectionEmbedFromParts({
    embedParam,
    cookieToken,
  });

  const token = resolved?.token ?? null;
  const claims: InspectionEmbedClaims | null = resolved?.claims ?? null;

  // Keep signed embed in the URL for iframe navigations (3P cookies often blocked).
  // Strip leftover soft scope params only when a real signed embed/cookie already exists.
  if (token && url.searchParams.get("scope") === "unit" && !embedParam) {
    for (const k of [
      "scope",
      "heltes_id",
      "alba_id",
      "heltes_name",
      "alba_name",
    ]) {
      url.searchParams.delete(k);
    }
    url.searchParams.set("embed", token);
    const res = NextResponse.redirect(url);
    res.cookies.set(INSPECTION_SCOPE_COOKIE, token, scopeCookieOptions());
    return res;
  }

  if (token) {
    const isApi = url.pathname.startsWith("/api/");
    if (claims?.mode === "unit" && !isApi && !allowedForUnit(url.pathname)) {
      const dash = new URL("/dashboard", request.url);
      dash.searchParams.set("embed", token);
      const res = NextResponse.redirect(dash);
      res.cookies.set(INSPECTION_SCOPE_COOKIE, token, scopeCookieOptions());
      return res;
    }

    if (
      !isApi &&
      claims &&
      (Array.isArray(claims.menus) || claims.submenus != null)
    ) {
      const selection: MenuRouteSelection = {
        menuIds: Array.isArray(claims.menus) ? claims.menus : null,
        submenuIds: claims.submenus ?? null,
      };
      if (
        !isPathAllowedByMenuSelection(
          url.pathname,
          selection,
          undefined,
          { emit: true, source: "middleware" },
        )
      ) {
        const dest = firstAllowedInspectionPath(selection);
        const redirectUrl = new URL(dest, request.url);
        redirectUrl.searchParams.set("embed", token);
        const res = NextResponse.redirect(redirectUrl);
        res.cookies.set(INSPECTION_SCOPE_COOKIE, token, scopeCookieOptions());
        return res;
      }
    } else if (!isApi && isNavG1Enforce()) {
      // NAV_G1_ENFORCE=1: signed embed without menu/submenu claims → fail closed.
      return navConfigMissing(url.pathname, "no_signed_nav_claims");
    }

    return withEmbedHeader(request, token);
  }

  // NAV_G1_ENFORCE=1: no valid embed/cookie → fail closed for pages.
  // (API routes keep their own scope/write checks: 401 via write-access.)
  if (isNavG1Enforce() && !url.pathname.startsWith("/api/")) {
    return navConfigMissing(url.pathname, "no_valid_embed");
  }

  return NextResponse.next();
}

export const config = {
  // Include /api so cookie-bound embed is forwarded as x-inspection-embed
  // (client fetch also sends the header when 3P cookies are blocked).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
