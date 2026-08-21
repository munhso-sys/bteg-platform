import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  POLICY_SCOPE_COOKIE,
  signPolicyEmbedToken,
  verifyPolicyEmbedToken,
  type PolicyEmbedClaims,
} from "@/lib/access/embed";

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
  if (scope !== "position" && scope !== "unit") return null;
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
        exp: soft.exp,
      });
      if (signed) {
        claims = soft;
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

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
