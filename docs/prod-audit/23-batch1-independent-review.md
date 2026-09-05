# 23 — Batch 1 independent review (read-only)

**Against HEAD:** `fix/prod-stabilization-p0` (post IC/RD app fixes)  
**Commits reviewed:** `3b90932`, `123c17f`, `6c4cb48`  
**Cherry-pick:** **not performed**

## 3b90932 — P0-01 RLS → **ACCEPT AFTER REWORK** (rollout sequencing)

### What changes
- Migration `20260904120000_lock_app_data_store_rls.sql`: ENABLE RLS; DROP open policies; REVOKE anon/authenticated; GRANT service_role.
- App: inspection + policy `createServerSupabaseClient` require `SUPABASE_SERVICE_ROLE_KEY` only (removes anon/hardcoded fallbacks on master).

### Classification of SQL
| Statement | Class |
|-----------|--------|
| ENABLE RLS | restrictive |
| DROP open policies | restrictive / immediately breaks anon writers |
| REVOKE anon/authenticated | restrictive / rollback-sensitive |
| GRANT service_role | additive clarity |

### Compatibility
- **Not** backward compatible with currently deployed master clients that fall back to anon/publishable keys for `app_data_store`.
- Requires **application-first** deploy of service-role-only writers **before** migration on shared DB.
- No org predicates / indexes added (JSON mega-row remains P0-03).

### Local DB
Not applied in this assignment (no local Supabase run required for IC/RD). Apply only on isolated DB in a later track.

### Verdict
Accept after confirming Preview apps have service role and anon path is dead; then migration-first is unsafe — **app then migrate**.

---

## 123c17f — P0-02 secrets → **ACCEPT AS-IS** (separate config track)

### What changes
- Removes hardcoded `inspect-platform-policy-embed-v1` and service-role-as-signer fallbacks.
- Introduces `POLICY_EMBED_SECRET` / `INSPECTION_EMBED_SECRET` (+ optional `*_PREVIOUS`).
- Server-side only; unit tests prove no hardcoded/service-role signing.

### Env consumers
| Variable | Apps | Side |
|----------|------|------|
| POLICY_EMBED_SECRET | portal + policy module verify | Server |
| INSPECTION_EMBED_SECRET | portal mint + inspection verify | Server |

### Missing secret behavior
- Sign returns null; verify fails → embed feature fails closed (with IC-D05, inspection writes deny). Portal login can remain up.

### Verdict
ACCEPT AS-IS for a **server-config** step after Track A. Do not require unrelated apps to share service-role for signing.

---

## 6c4cb48 — runtime-info → **ACCEPT AS-IS** (with access note)

### Fields exposed
`ok`, `app`, `version`, `commitSha` (masked), `deploymentId`, `vercelEnv`, `supabaseProjectRefMasked`, `schemaVersion`, booleans `hasServiceRole` / `hasPolicyEmbedSecret` / `hasInspectionEmbedSecret`.

### Secrets
No key/token/cookie/full URL values. Booleans only for secret presence.

### Notes
- Endpoint is unauthenticated in the commit; acceptable for non-sensitive fingerprint, but consider allowlisting / rate limit later.
- Distinguishes version fingerprint from deep health diagnostics.

### Verdict
ACCEPT AS-IS after Track A/C; optional.

---

## Summary

| Commit | Classification |
|--------|----------------|
| 3b90932 | ACCEPT AFTER REWORK (sequencing + Preview service-role proof) |
| 123c17f | ACCEPT AS-IS |
| 6c4cb48 | ACCEPT AS-IS |
