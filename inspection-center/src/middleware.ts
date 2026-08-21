import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  INSPECTION_SCOPE_COOKIE,
  INSPECTION_EMBED_HEADER,
  signInspectionEmbedToken,
  verifyInspectionEmbedToken,
  type InspectionEmbedClaims,
} from "@/lib/access/embed";

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

/** Soft query params — only used to mint a signed token once (never trusted raw). */
async function mintSoftUnitToken(
  request: NextRequest,
): Promise<string | null> {
  if (request.nextUrl.searchParams.get("scope") !== "unit") return null;
  const soft: Omit<InspectionEmbedClaims, "v"> = {
    uid: "soft",
    role: null,
    heltesId: request.nextUrl.searchParams.get("heltes_id"),
    albaId: request.nextUrl.searchParams.get("alba_id"),
    heltesName: request.nextUrl.searchParams.get("heltes_name"),
    albaName: request.nextUrl.searchParams.get("alba_name"),
    mode: "unit",
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };
  return signInspectionEmbedToken(soft);
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
  let token: string | null = null;
  let claims: InspectionEmbedClaims | null = null;

  if (embedParam) {
    claims = await verifyInspectionEmbedToken(embedParam);
    if (claims) token = embedParam;
  }

  if (!token) {
    const minted = await mintSoftUnitToken(request);
    if (minted) {
      claims = await verifyInspectionEmbedToken(minted);
      if (claims) token = minted;
    }
  }

  if (!token) {
    const cookieToken = request.cookies.get(INSPECTION_SCOPE_COOKIE)?.value;
    if (cookieToken) {
      claims = await verifyInspectionEmbedToken(cookieToken);
      if (claims) token = cookieToken;
    }
  }

  // Keep signed embed in the URL for iframe navigations (3P cookies often blocked).
  // Soft scope params can be stripped after minting a signed token into `embed`.
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

  if (claims?.mode === "unit" && !allowedForUnit(url.pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
