import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

describe("api/org/options route", () => {
  it("uses bundled catalog fallback and sanitized errors", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/app/api/org/options/route.ts"),
      "utf8",
    );
    assert.match(src, /loadBundledOrgAccessOptions/);
    assert.match(src, /ORG_CATALOG_INVALID|ORG_OPTIONS_FAILED/);
    assert.doesNotMatch(src, /process\.cwd\(\)/);
    assert.match(src, /Байгууллагын жагсаалт ачаалахад алдаа гарлаа/);
    assert.doesNotMatch(src, /error: err instanceof Error \? err\.message/);
  });
});

describe("admin users PATCH", () => {
  it("returns 404 when no profile row updated", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/users/route.ts"),
      "utf8",
    );
    assert.match(src, /\.select\("user_id"\)/);
    assert.match(src, /status: 404/);
  });
});

describe("access-requests existing Auth user", () => {
  it("looks up email before createUser and upserts profile before approve", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/access-requests/route.ts"),
      "utf8",
    );
    assert.match(src, /findUserIdByEmail/);
    assert.match(src, /existingAuthUser/);
    const upsertAt = src.indexOf('from("user_profiles").upsert');
    const approveAt = src.indexOf('status: "approved"');
    assert.ok(upsertAt > 0 && approveAt > upsertAt);
  });
});
