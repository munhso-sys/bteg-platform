import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  softUnitQueryIsTrustedAuthority,
  resolveInspectionEmbedFromParts,
} from "./embed-resolve";
import {
  signInspectionEmbedToken,
  verifyInspectionEmbedToken,
  type InspectionEmbedClaims,
} from "./embed";

function b64url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function withSecret<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.INSPECTION_EMBED_SECRET;
  process.env.INSPECTION_EMBED_SECRET = "ic-d01-regression-secret";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.INSPECTION_EMBED_SECRET;
    else process.env.INSPECTION_EMBED_SECRET = prev;
  }
}

function baseClaims(
  partial: Partial<InspectionEmbedClaims> = {},
): Omit<InspectionEmbedClaims, "v"> {
  return {
    uid: "u1",
    role: "inspector",
    heltesId: "h1",
    albaId: null,
    heltesName: "Heltes",
    albaName: null,
    mode: "unit",
    exp: Date.now() + 60_000,
    ...partial,
  };
}

describe("IC-D01 soft unit mint disabled", () => {
  it("unsigned scope=unit query is not a trusted mint authority", () => {
    assert.equal(softUnitQueryIsTrustedAuthority(), false);
  });

  it("unsigned unit query alone resolves to null", async () => {
    await withSecret(async () => {
      const resolved = await resolveInspectionEmbedFromParts({
        embedParam: null,
        cookieToken: null,
      });
      assert.equal(resolved, null);
    });
  });

  it("portal-signed embed still resolves", async () => {
    await withSecret(async () => {
      const token = await signInspectionEmbedToken(baseClaims());
      assert.ok(token);
      const resolved = await resolveInspectionEmbedFromParts({
        embedParam: token,
        cookieToken: null,
      });
      assert.ok(resolved);
      assert.equal(resolved.source, "embed");
      assert.equal(resolved.claims.mode, "unit");
    });
  });

  it("valid verified cookie resolves", async () => {
    await withSecret(async () => {
      const token = await signInspectionEmbedToken(
        baseClaims({ mode: "full", role: "admin" }),
      );
      assert.ok(token);
      const resolved = await resolveInspectionEmbedFromParts({
        embedParam: null,
        cookieToken: token,
      });
      assert.ok(resolved);
      assert.equal(resolved.source, "cookie");
      assert.equal(resolved.claims.role, "admin");
    });
  });

  it("embed param wins over disagreeing cookie", async () => {
    await withSecret(async () => {
      const embed = await signInspectionEmbedToken(
        baseClaims({ uid: "embed-user", mode: "full" }),
      );
      const cookie = await signInspectionEmbedToken(
        baseClaims({ uid: "cookie-user", mode: "unit" }),
      );
      assert.ok(embed && cookie);
      const resolved = await resolveInspectionEmbedFromParts({
        embedParam: embed,
        cookieToken: cookie,
      });
      assert.ok(resolved);
      assert.equal(resolved.source, "embed");
      assert.equal(resolved.claims.uid, "embed-user");
      assert.equal(resolved.claims.mode, "full");
    });
  });

  it("forged signature is rejected", async () => {
    await withSecret(async () => {
      const token = await signInspectionEmbedToken(baseClaims());
      assert.ok(token);
      const [body] = token.split(".");
      const forged = `${body}.Zm9yZ2Vkc2lnbmF0dXJl`;
      assert.equal(await verifyInspectionEmbedToken(forged), null);
      assert.equal(
        await resolveInspectionEmbedFromParts({
          embedParam: forged,
          cookieToken: null,
        }),
        null,
      );
    });
  });

  it("modified signed payload is rejected", async () => {
    await withSecret(async () => {
      const token = await signInspectionEmbedToken(baseClaims());
      assert.ok(token);
      const [, sig] = token.split(".");
      const tamperedBody = b64url(
        JSON.stringify({ ...baseClaims({ role: "admin", mode: "full" }), v: 1 }),
      );
      const tampered = `${tamperedBody}.${sig}`;
      assert.equal(await verifyInspectionEmbedToken(tampered), null);
    });
  });

  it("expired signed payload is rejected", async () => {
    await withSecret(async () => {
      const token = await signInspectionEmbedToken(
        baseClaims({ exp: Date.now() - 1_000 }),
      );
      assert.ok(token);
      assert.equal(await verifyInspectionEmbedToken(token), null);
    });
  });

  it("missing signature / malformed token rejected", async () => {
    await withSecret(async () => {
      assert.equal(await verifyInspectionEmbedToken("onlybody"), null);
      assert.equal(await verifyInspectionEmbedToken(""), null);
      assert.equal(await verifyInspectionEmbedToken("a.b.c"), null);
      assert.equal(
        await resolveInspectionEmbedFromParts({
          embedParam: "not-a-token",
          cookieToken: null,
        }),
        null,
      );
    });
  });

  it("absent dedicated env secrets: orphan-key forged tokens do not verify", async () => {
    const prev = process.env.INSPECTION_EMBED_SECRET;
    const prevPolicy = process.env.POLICY_EMBED_SECRET;
    delete process.env.INSPECTION_EMBED_SECRET;
    delete process.env.POLICY_EMBED_SECRET;
    try {
      const body = b64url(JSON.stringify({ v: 1, ...baseClaims() }));
      const sig = createHmac("sha256", "orphan-key")
        .update(body)
        .digest("base64url");
      assert.equal(await verifyInspectionEmbedToken(`${body}.${sig}`), null);
      // Note: master lineage may still sign via hardcoded fallback (P0-02 /
      // Batch1 123c17f — excluded from this branch). Signing without env is
      // tracked separately; this assertion only covers verify fail-closed.
    } finally {
      if (prev === undefined) delete process.env.INSPECTION_EMBED_SECRET;
      else process.env.INSPECTION_EMBED_SECRET = prev;
      if (prevPolicy === undefined) delete process.env.POLICY_EMBED_SECRET;
      else process.env.POLICY_EMBED_SECRET = prevPolicy;
    }
  });

  it("unsigned query cannot override a valid signed scope via resolve API", async () => {
    await withSecret(async () => {
      const token = await signInspectionEmbedToken(
        baseClaims({ mode: "full", heltesName: "Real" }),
      );
      assert.ok(token);
      // resolve API has no soft-query input — unsigned params are not authority
      const resolved = await resolveInspectionEmbedFromParts({
        embedParam: token,
        cookieToken: null,
      });
      assert.ok(resolved);
      assert.equal(resolved.claims.heltesName, "Real");
      assert.equal(softUnitQueryIsTrustedAuthority(), false);
    });
  });

  it("middleware source must not call soft mint helper", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");
    assert.doesNotMatch(src, /mintSoftUnitToken/);
    assert.match(src, /resolveInspectionEmbedFromParts/);
    assert.match(src, /IC-D01/);
  });
});
