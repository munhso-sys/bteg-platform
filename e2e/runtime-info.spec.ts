import { expect, test } from "@playwright/test";
import { portalUrl } from "./helpers";

test.describe("runtime-info", () => {
  test("no secrets and cache-safe fields", async ({ request }) => {
    const a = await request.get(`${portalUrl()}/api/runtime-info`);
    const b = await request.get(`${portalUrl()}/api/runtime-info`);
    expect(a.ok() && b.ok()).toBeTruthy();
    const ja = await a.json();
    const jb = await b.json();
    expect(ja.app).toBe("inspect-mn");
    expect(ja.schemaVersion).toBeTruthy();
    expect(JSON.stringify(ja)).toEqual(JSON.stringify(jb));
    expect(JSON.stringify(ja)).not.toMatch(/eyJhbGciOi/);
    expect(JSON.stringify(ja)).not.toMatch(/BEGIN (RSA |EC )?PRIVATE KEY/);
  });
});
