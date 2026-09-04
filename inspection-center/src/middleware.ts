import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  INSPECTION_SCOPE_COOKIE,
  INSPECTION_EMBED_HEADER,
  type InspectionEmbedClaims,
} from "@/lib/access/embed";
import { resolveInspectionEmbedFromParts } from "@/lib/access/embed-resolve";

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
    if (claims?.mode === "unit" && !allowedForUnit(url.pathname)) {
      const dash = new URL("/dashboard", request.url);
      dash.searchParams.set("embed", token);
      const res = NextResponse.redirect(dash);
      res.cookies.set(INSPECTION_SCOPE_COOKIE, token, scopeCookieOptions());
      return res;
    }
    return withEmbedHeader(request, token);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
