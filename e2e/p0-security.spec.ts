import { expect, test } from "@playwright/test";

/**
 * Production-mode security probes. Skips when servers/env not available.
 * Full auth flows require local Supabase + seeded users (see docs/prod-audit/26).
 */
const inspection = process.env.E2E_INSPECTION_URL || "";
const portal = process.env.E2E_PORTAL_URL || "";
const development = process.env.E2E_DEVELOPMENT_URL || "";

test.describe("IC-D01 / IC-D05 HTTP", () => {
  test.skip(!inspection, "E2E_INSPECTION_URL unset");

  test("IC-D05 unauthenticated PATCH denied", async ({ request }) => {
    const res = await request.patch(
      `${inspection}/api/runs/00000000-0000-4000-8000-000000000001/answers`,
      { data: { answers: [] } },
    );
    expect([401, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.ok).toBeFalsy();
  });

  test("IC-D01 soft unit query does not mint embed cookie", async ({
    request,
  }) => {
    const res = await request.get(
      `${inspection}/dashboard?scope=unit&heltes_id=x&heltes_name=Forged`,
      { maxRedirects: 0 },
    );
    const setCookie = res.headers()["set-cookie"] || "";
    expect(setCookie).not.toMatch(/inspection_scope=/);
  });
});

test.describe("Portal runtime-info", () => {
  test.skip(!portal, "E2E_PORTAL_URL unset");

  test("runtime-info has no secret values", async ({ request }) => {
    const res = await request.get(`${portal}/api/runtime-info`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const dumped = JSON.stringify(body);
    expect(dumped).not.toMatch(/eyJhbGciOi/);
    expect(dumped).not.toMatch(/service_role/i);
    expect(body).toHaveProperty("commitSha");
    expect(body).toHaveProperty("vercelEnv");
    expect(typeof body.hasServiceRole).toBe("boolean");
  });
});

test.describe("Research API authz", () => {
  test.skip(!development, "E2E_DEVELOPMENT_URL unset");

  test("unauthenticated research list denied", async ({ request }) => {
    const res = await request.get(`${development}/api/research/projects`);
    expect([401, 403]).toContain(res.status());
  });
});
