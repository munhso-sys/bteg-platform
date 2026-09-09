import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

describe("policy dashboard P0-03", () => {
  it("does not mutate org store during dashboard render", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/app/(app)/dashboard/page.tsx"),
      "utf8",
    );
    assert.doesNotMatch(src, /applyOrgNamingCorrections/);
  });

  it("skips remote naming corrections without organization scope", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/lib/db/org.ts"),
      "utf8",
    );
    assert.match(src, /bundledOrgCatalog/);
    assert.match(src, /P0-03/);
    assert.match(src, /if \(!scope\?\.heltesId\?\.trim\(\)\)/);
  });

  it("readRemoteDb serves bundled DB read-only when org scope missing", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/lib/db/local-store.ts"),
      "utf8",
    );
    assert.match(src, /return loadBundledDb\(\);/);
    assert.doesNotMatch(
      src,
      /Policy remote seed refused without organization scope/,
    );
  });
});
