import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("A3 /api/runtime-info contract", () => {
  it("route source never references secret key values or full anon JWT printing", () => {
    const src = readFileSync(path.join(here, "route.ts"), "utf8");
    assert.match(src, /supabaseProjectRefMasked/);
    assert.match(src, /schemaVersion/);
    assert.match(src, /hasServiceRole:\s*Boolean/);
    assert.match(src, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(src, /inspect-platform-policy-embed-v1/);
    assert.doesNotMatch(src, /eyJhbGciOi/);
  });
});
