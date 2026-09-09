import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  getRemoteStoreServiceRoleKey,
  isSupabaseConfigured,
} from "./server";

describe("P0-01 remote store client requires service role", () => {
  it("isSupabaseConfigured is false without service role", () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    try {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJ.test";
      assert.equal(getRemoteStoreServiceRoleKey(), "");
      assert.equal(isSupabaseConfigured(), false);
    } finally {
      if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
      if (prevAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnon;
    }
  });

  it("migration drops open app_data_store policies and revokes anon", () => {
    const migration = readFileSync(
      path.join(
        process.cwd(),
        "../inspect-mn/supabase/migrations/20260906140000_lock_app_data_store_rls.sql",
      ),
      "utf8",
    );
    assert.match(migration, /drop policy if exists/i);
    assert.match(migration, /revoke all on table public\.app_data_store from anon/i);
    assert.match(migration, /grant all on table public\.app_data_store to service_role/i);
    assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
  });

  it("server module does not fall back to anon or hardcoded keys", () => {
    const src = readFileSync(path.join(process.cwd(), "src/lib/supabase/server.ts"), "utf8");
    assert.doesNotMatch(src, /FALLBACK_SUPABASE/);
    assert.doesNotMatch(src, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    assert.match(src, /SUPABASE_SERVICE_ROLE_KEY/);
  });
});
