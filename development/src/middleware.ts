import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DEVELOPMENT_NAV_COOKIE,
  DEVELOPMENT_NAV_ENFORCE_COOKIE,
  firstAllowedDevelopmentPath,
  isDevelopmentPathAllowed,
  isNavEnforcementActive,
  verifyModuleNavGrant,
} from "@/lib/access/nav-grant";

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
    const grant = await verifyModuleNavGrant(navParam, "development");
    if (!grant) {
      return denyReembed(request);
    }
    const navToken = navParam;
    if (!isDevelopmentPathAllowed(url.pathname, grant)) {
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
    const grant = await verifyModuleNavGrant(cookieToken, "development");
    if (!grant) {
      return denyReembed(request);
    }
    if (!isDevelopmentPathAllowed(url.pathname, grant)) {
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

  if (isNavEnforcementActive(enforce)) {
    return denyReembed(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
