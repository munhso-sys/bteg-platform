export type InspectionEmbedMode = "full" | "unit";

export type InspectionEmbedClaims = {
  v: 1;
  uid: string;
  role: string | null;
  heltesId: string | null;
  albaId: string | null;
  heltesName: string | null;
  albaName: string | null;
  mode: InspectionEmbedMode;
  exp: number;
};

export const INSPECTION_SCOPE_COOKIE = "inspection_scope";
/** Forwarded by middleware so RSC can read scope without relying on 3P cookies. */
export const INSPECTION_EMBED_HEADER = "x-inspection-embed";

function signSecret() {
  return (
    process.env.INSPECTION_EMBED_SECRET?.trim() ||
    process.env.POLICY_EMBED_SECRET?.trim() ||
    ""
  );
}

function verifySecrets() {
  return [
    ...new Set(
      [
        process.env.INSPECTION_EMBED_SECRET?.trim(),
        process.env.INSPECTION_EMBED_SECRET_PREVIOUS?.trim(),
        process.env.POLICY_EMBED_SECRET?.trim(),
        process.env.POLICY_EMBED_SECRET_PREVIOUS?.trim(),
      ].filter((s): s is string => Boolean(s)),
    ),
  ];
}

function b64urlFromBytes(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesFromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256Base64Url(body: string, key: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(body));
  return b64urlFromBytes(sig);
}

function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function verifyInspectionEmbedToken(
  token: string | null | undefined,
): Promise<InspectionEmbedClaims | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let ok = false;
  for (const key of verifySecrets()) {
    const expected = await hmacSha256Base64Url(body, key);
    if (timingSafeEqualStr(sig, expected)) {
      ok = true;
      break;
    }
  }
  if (!ok) return null;
  try {
    const json = new TextDecoder().decode(bytesFromB64url(body));
    const parsed = JSON.parse(json) as InspectionEmbedClaims;
    if (parsed?.v !== 1 || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    if (parsed.mode !== "full" && parsed.mode !== "unit") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function signInspectionEmbedToken(
  claims: Omit<InspectionEmbedClaims, "v">,
): Promise<string | null> {
  const key = signSecret();
  if (!key) return null;
  const payload: InspectionEmbedClaims = { v: 1, ...claims };
  const body = b64urlFromBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSha256Base64Url(body, key);
  return `${body}.${sig}`;
}

export function isUnitScopedInspection(
  claims: InspectionEmbedClaims | null | undefined,
) {
  return claims?.mode === "unit";
}

export function unitLabels(claims: InspectionEmbedClaims | null | undefined) {
  return [claims?.albaName, claims?.heltesName]
    .filter(Boolean)
    .map((s) =>
      String(s)
        .toLowerCase()
        .replace(/[[\]]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
}

export function matchesInspectionUnit(
  value: string | null | undefined,
  claims: InspectionEmbedClaims | null | undefined,
) {
  if (!isUnitScopedInspection(claims)) return true;
  const labels = unitLabels(claims);
  if (!labels.length) return false;
  const n = String(value ?? "")
    .toLowerCase()
    .replace(/[[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return false;
  return labels.some((l) => n.includes(l) || l.includes(n));
}
