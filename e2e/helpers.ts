import { expect, type APIRequestContext } from "@playwright/test";

export function requireUrl(name: string, value: string) {
  if (!value) {
    throw new Error(`${name} is required for E2E (set by gate runner)`);
  }
  return value;
}

export const portalUrl = () =>
  requireUrl("E2E_PORTAL_URL", process.env.E2E_PORTAL_URL || "");
export const inspectionUrl = () =>
  requireUrl("E2E_INSPECTION_URL", process.env.E2E_INSPECTION_URL || "");
export const developmentUrl = () =>
  requireUrl("E2E_DEVELOPMENT_URL", process.env.E2E_DEVELOPMENT_URL || "");

export const userA = {
  email: process.env.E2E_USER_A_EMAIL || "e2e-org-a@example.com",
  password: process.env.E2E_USER_A_PASSWORD || "Passw0rd!e2eA",
  org: process.env.E2E_ORG_A || "org-a",
};
export const userB = {
  email: process.env.E2E_USER_B_EMAIL || "e2e-org-b@example.com",
  password: process.env.E2E_USER_B_PASSWORD || "Passw0rd!e2eB",
  org: process.env.E2E_ORG_B || "org-b",
};

export async function signInTokens(email: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL/ANON_KEY required for token sign-in");
  }
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anon,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
    msg?: string;
  };
  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new Error(
      body.error_description || body.msg || `sign-in failed (${res.status})`,
    );
  }
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  };
}

/** Establish development module session cookies via /api/auth/session. */
export async function establishDevSession(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const tokens = await signInTokens(email, password);
  const res = await request.post(`${developmentUrl()}/api/auth/session`, {
    data: tokens,
  });
  const body = await res.json();
  expect(res.ok(), JSON.stringify(body)).toBeTruthy();
  return tokens;
}
