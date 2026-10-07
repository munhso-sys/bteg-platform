import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  decideDevelopmentNavigation,
  DEVELOPMENT_NAV_COOKIE,
  DEVELOPMENT_NAV_ENFORCE_COOKIE,
  firstAllowedDevelopmentPath,
  inspectModuleNavGrant,
  isNavEnforcementActive,
} from "@/lib/access/nav-grant";

/**
 * Nav grant / enforce cookies are HttpOnly, Secure, SameSite=None so the
 * portal iframe can carry them (third-party context). Do NOT weaken `secure`
 * in production/hosted runtimes; relax only for a verified non-hosted local
 * runtime if ever needed (browsers treat http://localhost as secure).
 */
function cookieOpts(maxAge = 12 * 60 * 60) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
    maxAge,
  };
}

function withNav(
  request: NextRequest,
  destPath: string,
  navToken: string | null,
) {
  const dest = new URL(destPath, request.url);
  if (navToken) dest.searchParams.set("nav", navToken);
  const rdUid = request.nextUrl.searchParams.get("rd_uid");
  if (rdUid) dest.searchParams.set("rd_uid", rdUid);
  return dest;
}

function markEnforce(res: NextResponse) {
  res.cookies.set(DEVELOPMENT_NAV_ENFORCE_COOKIE, "1", cookieOpts());
}

function denyReembed(request: NextRequest) {
  // Already bounced once and still no valid grant → stop (avoid redirect loop).
  if (request.nextUrl.searchParams.get("nav_reembed") === "1") {
    return new NextResponse(
      "Navigation grant required. Re-open this module from the portal.",
      { status: 403 },
    );
  }
  const dest = new URL("/dashboard", request.url);
  dest.searchParams.set("nav_reembed", "1");
  const res = NextResponse.redirect(dest);
  res.cookies.delete(DEVELOPMENT_NAV_COOKIE);
  markEnforce(res);
  return res;
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  const navParam = url.searchParams.get("nav");
  const cookieToken =
    request.cookies.get(DEVELOPMENT_NAV_COOKIE)?.value ?? null;
  const enforce = request.cookies.get(DEVELOPMENT_NAV_ENFORCE_COOKIE)?.value;

  if (navParam) {
    const inspected = await inspectModuleNavGrant(navParam, "development");
    if (inspected.state !== "valid") {
      decideDevelopmentNavigation(url.pathname, null, {
        tokenState: inspected.state,
        emit: true,
        source: "middleware",
      });
      return denyReembed(request);
    }
    const grant = inspected.grant;
    const navToken = navParam;
    const decision = decideDevelopmentNavigation(url.pathname, grant, {
      emit: true,
      source: "middleware",
    });
    if (!decision.allow) {
      const dest = withNav(
        request,
        firstAllowedDevelopmentPath(grant),
        navToken,
      );
      const res = NextResponse.redirect(dest);
      res.cookies.set(DEVELOPMENT_NAV_COOKIE, navToken, cookieOpts());
      markEnforce(res);
      return res;
    }
    const res = NextResponse.next();
    res.cookies.set(DEVELOPMENT_NAV_COOKIE, navToken, cookieOpts());
    markEnforce(res);
    return res;
  }

  if (cookieToken) {
    const inspected = await inspectModuleNavGrant(cookieToken, "development");
    if (inspected.state !== "valid") {
      decideDevelopmentNavigation(url.pathname, null, {
        tokenState: inspected.state,
        emit: true,
        source: "middleware",
      });
      return denyReembed(request);
    }
    const grant = inspected.grant;
    const decision = decideDevelopmentNavigation(url.pathname, grant, {
      emit: true,
      source: "middleware",
    });
    if (!decision.allow) {
      const res = NextResponse.redirect(
        withNav(request, firstAllowedDevelopmentPath(grant), cookieToken),
      );
      markEnforce(res);
      return res;
    }
    const res = NextResponse.next();
    markEnforce(res);
    return res;
  }

  // No grant token: unrestricted only pre-G1 AND never under nav enforcement.
  // NAV_G1_ENFORCE=1 → fail closed / re-embed.
  const noGrant = decideDevelopmentNavigation(url.pathname, null, {
    enforceMarker: isNavEnforcementActive(enforce),
    emit: true,
    source: "middleware",
  });
  if (!noGrant.allow) {
    return denyReembed(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
