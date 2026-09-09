import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { inspectionUrl, portalUrl } from "./helpers";

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signEmbed(claims: Record<string, unknown>, secret: string) {
  const payload = b64url(JSON.stringify({ ...claims, v: 1 }));
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

test.describe("Portal / embed security", () => {
  test("runtime-info approved fields only", async ({ request }) => {
    const res = await request.get(`${portalUrl()}/api/runtime-info`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const dumped = JSON.stringify(body);
    expect(dumped).not.toMatch(/eyJhbGciOi/);
    expect(dumped).not.toMatch(/service_role/i);
    expect(dumped).not.toMatch(/postgres(ql)?:\/\//i);
    expect(body).toHaveProperty("commitSha");
    expect(body).toHaveProperty("vercelEnv");
    expect(body).toHaveProperty("schemaVersion");
    expect(typeof body.hasServiceRole).toBe("boolean");
    expect(typeof body.hasPolicyEmbedSecret).toBe("boolean");
  });

  test("IC-D01 soft unit query does not mint embed cookie", async ({
    request,
  }) => {
    const res = await request.get(
      `${inspectionUrl()}/dashboard?scope=unit&heltes_id=x&heltes_name=Forged`,
      { maxRedirects: 0 },
    );
    const setCookie = res.headers()["set-cookie"] || "";
    expect(setCookie).not.toMatch(/inspection_scope=/);
  });

  test("IC-D05 unauthenticated PATCH denied", async ({ request }) => {
    const res = await request.patch(
      `${inspectionUrl()}/api/runs/00000000-0000-4000-8000-000000000001/answers`,
      { data: { answers: [] } },
    );
    expect([401, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.ok).toBeFalsy();
  });

  test("missing embed token does not elevate", async ({ request }) => {
    const res = await request.get(`${inspectionUrl()}/dashboard`, {
      maxRedirects: 0,
    });
    const setCookie = res.headers()["set-cookie"] || "";
    expect(setCookie).not.toMatch(/inspection_scope=/);
  });

  test("forged / modified / expired tokens denied", async ({ request }) => {
    const secret = process.env.INSPECTION_EMBED_SECRET?.trim();
    expect(secret, "INSPECTION_EMBED_SECRET must be set on gate runner").toBeTruthy();

    const baseClaims = {
      uid: "e2e",
      role: "inspector",
      heltesId: "org-a",
      mode: "unit",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const good = signEmbed(baseClaims, secret!);
    const forged = signEmbed(baseClaims, "wrong-secret");
    const expired = signEmbed(
      { ...baseClaims, exp: Math.floor(Date.now() / 1000) - 60 },
      secret!,
    );
    const parts = good.split(".");
    const modified = `${parts[0]}.${parts[1].slice(0, -2)}aa`;

    for (const token of [forged, expired, modified, "not-a-token"]) {
      const res = await request.get(
        `${inspectionUrl()}/dashboard?embed=${encodeURIComponent(token)}`,
        { maxRedirects: 0 },
      );
      const setCookie = res.headers()["set-cookie"] || "";
      // Must not establish a trusted scope cookie from bad tokens.
      if (setCookie.match(/inspection_scope=/)) {
        expect(token).toBe(good);
      } else {
        expect(setCookie).not.toMatch(/inspection_scope=/);
      }
    }
  });

  test("unsigned query cannot elevate with forged heltes", async ({
    request,
  }) => {
    const res = await request.get(
      `${inspectionUrl()}/dashboard?scope=full&heltes_id=org-a&role=admin`,
      { maxRedirects: 0 },
    );
    const setCookie = res.headers()["set-cookie"] || "";
    expect(setCookie).not.toMatch(/inspection_scope=/);
  });

  test("hardcoded legacy signing secret is absent from embed config module", async ({
    request,
  }) => {
    // Runtime check: forging with known legacy string must not verify when env secret differs.
    const legacy = "inspect-platform-policy-embed-v1";
    const secret = process.env.INSPECTION_EMBED_SECRET?.trim() || "";
    expect(secret).not.toEqual(legacy);
    const token = signEmbed(
      {
        uid: "e2e",
        role: "inspector",
        heltesId: "org-a",
        mode: "unit",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      legacy,
    );
    const res = await request.get(
      `${inspectionUrl()}/dashboard?embed=${encodeURIComponent(token)}`,
      { maxRedirects: 0 },
    );
    const setCookie = res.headers()["set-cookie"] || "";
    expect(setCookie).not.toMatch(/inspection_scope=/);
  });
});
