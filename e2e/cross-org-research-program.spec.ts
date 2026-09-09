import { expect, test } from "@playwright/test";
import {
  developmentUrl,
  establishDevSession,
  userA,
  userB,
} from "./helpers";

test.describe("Cross-organization + research + program", () => {
  test("A creates research project; B cannot list or update it", async ({
    request,
    browser,
  }) => {
    await establishDevSession(request, userA.email, userA.password);
    const title = `E2E-A-${Date.now()}`;
    const create = await request.post(`${developmentUrl()}/api/research/projects`, {
      data: { title, status: "active" },
    });
    const created = await create.json();
    expect(create.ok(), JSON.stringify(created)).toBeTruthy();
    const id = created.project?.id as string;
    expect(id).toBeTruthy();

    const listA = await request.get(`${developmentUrl()}/api/research/projects`);
    const bodyA = await listA.json();
    expect(bodyA.projects.some((p: { id: string }) => p.id === id)).toBeTruthy();

    // Separate browser context as B
    const ctxB = await browser.newContext();
    const reqB = ctxB.request;
    await establishDevSession(reqB, userB.email, userB.password);
    const listB = await reqB.get(`${developmentUrl()}/api/research/projects`);
    const bodyB = await listB.json();
    expect(listB.ok()).toBeTruthy();
    expect(bodyB.projects.some((p: { id: string }) => p.id === id)).toBeFalsy();

    const updateB = await reqB.patch(`${developmentUrl()}/api/research/projects`, {
      data: { id, title: "hijack" },
    });
    expect([403, 404]).toContain(updateB.status());

    const forge = await reqB.post(`${developmentUrl()}/api/research/projects`, {
      data: { title: "forge", organization_id: userA.org },
    });
    expect([403, 400]).toContain(forge.status());

    await ctxB.close();

    // Edit as A persists
    const edit = await request.patch(`${developmentUrl()}/api/research/projects`, {
      data: { id, title: `${title}-edited` },
    });
    expect(edit.ok()).toBeTruthy();
    const again = await request.get(`${developmentUrl()}/api/research/projects`);
    const againBody = await again.json();
    const row = againBody.projects.find((p: { id: string }) => p.id === id);
    expect(row?.title).toContain("edited");
  });

  test("program initiatives CRUD + cross-org denial", async ({
    request,
    browser,
  }) => {
    await establishDevSession(request, userA.email, userA.password);
    const title = `Prog-A-${Date.now()}`;
    const create = await request.post(`${developmentUrl()}/api/research/program`, {
      data: {
        title,
        pillarId: "research",
        status: "planned",
        year: new Date().getFullYear(),
      },
    });
    const created = await create.json();
    expect(create.ok(), JSON.stringify(created)).toBeTruthy();
    const id = created.item?.id as string;
    expect(id).toBeTruthy();

    const listA = await request.get(`${developmentUrl()}/api/research/program`);
    const bodyA = await listA.json();
    expect(bodyA.items.some((i: { id: string }) => i.id === id)).toBeTruthy();

    const patch = await request.patch(`${developmentUrl()}/api/research/program`, {
      data: { id, title: `${title}-v2`, status: "in_progress" },
    });
    expect(patch.ok()).toBeTruthy();

    const ctxB = await browser.newContext();
    const reqB = ctxB.request;
    await establishDevSession(reqB, userB.email, userB.password);
    const listB = await reqB.get(`${developmentUrl()}/api/research/program`);
    const bodyB = await listB.json();
    expect(bodyB.items.some((i: { id: string }) => i.id === id)).toBeFalsy();

    const updateB = await reqB.patch(`${developmentUrl()}/api/research/program`, {
      data: { id, title: "stolen" },
    });
    expect([403, 404]).toContain(updateB.status());

    const forge = await reqB.post(`${developmentUrl()}/api/research/program`, {
      data: { title: "x", organization_id: userA.org, pillarId: "research" },
    });
    expect([403, 401]).toContain(forge.status());
    await ctxB.close();
  });

  test("localStorage org tamper does not authorize research write", async ({
    page,
    request,
  }) => {
    await establishDevSession(request, userB.email, userB.password);
    await page.goto(`${developmentUrl()}/projects`);
    await page.evaluate(() => {
      localStorage.setItem("rd_uid", "forged-admin");
      localStorage.setItem("organization_id", "org-a");
      localStorage.setItem("rd-program-initiatives-v1:forged", "[]");
    });
    const forge = await request.post(`${developmentUrl()}/api/research/projects`, {
      data: { title: "from-localstorage", organization_id: "org-a" },
    });
    // Still B session — forge org must be rejected or inserted under B only.
    if (forge.ok()) {
      const body = await forge.json();
      expect(String(body.project?.organization_id || "")).not.toEqual("org-a");
    } else {
      expect([403, 400]).toContain(forge.status());
    }
  });

  test("unauthenticated research/program APIs denied", async ({ browser }) => {
    const ctx = await browser.newContext();
    const req = ctx.request;
    expect([401, 403]).toContain(
      (await req.get(`${developmentUrl()}/api/research/projects`)).status(),
    );
    expect([401, 403]).toContain(
      (await req.get(`${developmentUrl()}/api/research/program`)).status(),
    );
    await ctx.close();
  });
});
