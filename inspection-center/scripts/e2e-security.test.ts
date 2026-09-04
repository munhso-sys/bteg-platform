/**
 * HTTP-level security checks for IC-D01 / IC-D05 against a running
 * production-mode server (next start). Does not use production data.
 *
 * Usage:
 *   INSPECTION_E2E_BASE_URL=http://127.0.0.1:3001 npm run test:e2e:security
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signInspectionEmbedToken } from "../src/lib/access/embed";

const base = (process.env.INSPECTION_E2E_BASE_URL || "").replace(/\/$/, "");

describe("IC security HTTP (optional; requires next start)", () => {
  it(
    "IC-D05: PATCH answers without embed returns 401/403",
    { skip: !base },
    async () => {
      const res = await fetch(
        `${base}/api/runs/00000000-0000-4000-8000-000000000001/answers`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answers: [] }),
        },
      );
      assert.ok(
        res.status === 401 || res.status === 403,
        `expected 401/403, got ${res.status}`,
      );
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      assert.equal(body?.ok, false);
    },
  );

  it(
    "IC-D05: unit embed cookie still denied for PATCH",
    { skip: !base },
    async () => {
      const prev = process.env.INSPECTION_EMBED_SECRET;
      process.env.INSPECTION_EMBED_SECRET =
        process.env.INSPECTION_EMBED_SECRET?.trim() ||
        "local-e2e-inspection-embed-secret";
      try {
        const token = await signInspectionEmbedToken({
          uid: "e2e-unit",
          role: "inspector",
          heltesId: "h1",
          albaId: null,
          heltesName: "Unit",
          albaName: null,
          mode: "unit",
          exp: Date.now() + 60_000,
        });
        assert.ok(token);
        const res = await fetch(
          `${base}/api/runs/00000000-0000-4000-8000-000000000001/answers`,
          {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              cookie: `inspection_scope=${token}`,
            },
            body: JSON.stringify({ answers: [] }),
          },
        );
        // Verified unit → 403; secret mismatch → treated as missing → 401.
        assert.ok(
          res.status === 401 || res.status === 403,
          `expected 401/403, got ${res.status}`,
        );
      } finally {
        if (prev === undefined) delete process.env.INSPECTION_EMBED_SECRET;
        else process.env.INSPECTION_EMBED_SECRET = prev;
      }
    },
  );

  it(
    "IC-D01: soft scope query does not mint embed redirect or scope cookie",
    { skip: !base },
    async () => {
      const res = await fetch(
        `${base}/dashboard?scope=unit&heltes_id=x&heltes_name=Forged`,
        { redirect: "manual" },
      );
      const setCookie = [
        ...(typeof res.headers.getSetCookie === "function"
          ? res.headers.getSetCookie()
          : []),
        res.headers.get("set-cookie") || "",
      ].join("\n");
      const location = res.headers.get("location") || "";
      if (res.status >= 300 && res.status < 400) {
        assert.doesNotMatch(location, /[?&]embed=/);
      }
      assert.doesNotMatch(setCookie, /inspection_scope=/);
    },
  );
});
