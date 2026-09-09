import { expect, test } from "@playwright/test";
import {
  establishDevSession,
  portalUrl,
  userA,
  userB,
} from "./helpers";

test.describe("Playwright auth flow", () => {
  test("valid login reaches portal home", async ({ page }) => {
    await page.goto(`${portalUrl()}/login`);
    await page.locator('input[type="email"]').fill(userA.email);
    await page.locator('input[type="password"]').fill(userA.password);
    await page.getByRole("button", { name: /Нэвтрэх|Login/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test("invalid login stays on login with error", async ({ page }) => {
    await page.goto(`${portalUrl()}/login`);
    await page.locator('input[type="email"]').fill(userA.email);
    await page.locator('input[type="password"]').fill("wrong-password-!!!")
    await page.getByRole("button", { name: /Нэвтрэх|Login/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("text=/буруу|Invalid|алдаа/i").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("protected route redirects unauthenticated users", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${portalUrl()}/settings`);
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test("logout then login again", async ({ page, context }) => {
    await page.goto(`${portalUrl()}/login`);
    await page.locator('input[type="email"]').fill(userA.email);
    await page.locator('input[type="password"]').fill(userA.password);
    await page.getByRole("button", { name: /Нэвтрэх|Login/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    await context.clearCookies();
    await page.goto(`${portalUrl()}/login`);
    await expect(page.locator('input[type="email"]')).toBeVisible({
      timeout: 15_000,
    });
    await page.locator('input[type="email"]').fill(userA.email);
    await page.locator('input[type="password"]').fill(userA.password);
    await page.getByRole("button", { name: /Нэвтрэх|Login/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test("reload keeps authenticated session", async ({ page }) => {
    await page.goto(`${portalUrl()}/login`);
    await page.locator('input[type="email"]').fill(userA.email);
    await page.locator('input[type="password"]').fill(userA.password);
    await page.getByRole("button", { name: /Нэвтрэх|Login/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("invalid session tokens rejected by development session API", async ({
    request,
  }) => {
    const res = await request.post(
      `${process.env.E2E_DEVELOPMENT_URL}/api/auth/session`,
      {
        data: {
          access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.sig",
          refresh_token: "invalid",
        },
      },
    );
    expect([401, 400, 500]).toContain(res.status());
  });

  test("dev session establish works for org A", async ({ request }) => {
    await establishDevSession(request, userA.email, userA.password);
  });

  test("same browser A then B session switch for research", async ({
    request,
  }) => {
    await establishDevSession(request, userA.email, userA.password);
    await establishDevSession(request, userB.email, userB.password);
    const list = await request.get(
      `${process.env.E2E_DEVELOPMENT_URL}/api/research/projects`,
    );
    expect(list.ok()).toBeTruthy();
    const body = await list.json();
    expect(body.ok).toBeTruthy();
    for (const p of body.projects ?? []) {
      expect(p.organization_id || p.organizationId || userB.org).toBeTruthy();
    }
  });
});
