import { expect, test } from "@playwright/test";
import { inspectionUrl } from "./helpers";

test.describe("IC HTTP security (production mode)", () => {
  test("null / missing scope write denied", async ({ request }) => {
    const res = await request.patch(
      `${inspectionUrl()}/api/runs/00000000-0000-4000-8000-000000000099/answers`,
      { data: { answers: [{ questionId: "q1", value: "yes" }] } },
    );
    expect([401, 403]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    expect(body.ok === false || body.ok === undefined).toBeTruthy();
  });

  test("forged unit scope query does not authorize write", async ({
    request,
  }) => {
    const res = await request.patch(
      `${inspectionUrl()}/api/runs/00000000-0000-4000-8000-000000000099/answers?scope=unit&heltes_id=org-a`,
      { data: { answers: [] } },
    );
    expect([401, 403]).toContain(res.status());
  });

  test("zero-row style unknown run is not success", async ({ request }) => {
    const res = await request.patch(
      `${inspectionUrl()}/api/runs/00000000-0000-4000-8000-000000000000/answers`,
      { data: { answers: [] } },
    );
    expect([401, 403, 404]).toContain(res.status());
    if (res.status() < 500) {
      const body = await res.json().catch(() => ({}));
      expect(body.ok).not.toBeTruthy();
    }
  });
});
