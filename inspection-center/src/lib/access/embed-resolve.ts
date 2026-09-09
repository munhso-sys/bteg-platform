import {
  verifyInspectionEmbedToken,
  type InspectionEmbedClaims,
} from "@/lib/access/embed";

/**
 * IC-D01: unsigned `scope=unit&heltes_*` query params must NEVER mint a signed
 * embed token. Only portal-provided `embed` or a previously verified cookie.
 */
export async function resolveInspectionEmbedFromParts(parts: {
  embedParam: string | null | undefined;
  cookieToken: string | null | undefined;
}): Promise<{
  token: string;
  claims: InspectionEmbedClaims;
  source: "embed" | "cookie";
} | null> {
  const embedParam = parts.embedParam?.trim() || null;
  if (embedParam) {
    const claims = await verifyInspectionEmbedToken(embedParam);
    if (claims) {
      return { token: embedParam, claims, source: "embed" };
    }
  }

  const cookieToken = parts.cookieToken?.trim() || null;
  if (cookieToken) {
    const claims = await verifyInspectionEmbedToken(cookieToken);
    if (claims) {
      return { token: cookieToken, claims, source: "cookie" };
    }
  }

  return null;
}

/** Soft unit query is display/debug only — never authority to mint HMAC. */
export function softUnitQueryIsTrustedAuthority(): boolean {
  return false;
}
