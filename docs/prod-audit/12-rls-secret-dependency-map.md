# 12 — RLS / secret dependency map (evidence-based)

**Scope:** Verify prior claim that Batch 1 RLS migration “requires SUPABASE_SERVICE_ROLE_KEY + embed secrets on all apps.”  
**Method:** File:line inspection on `fix/prod-batch-1-security` and `master`. No production changes.

## Direct answers

| # | Question | Answer |
|---|----------|--------|
| 1 | Does the **SQL migration itself** require an API service-role key? | **No.** SQL is DDL/DCL (`ENABLE RLS`, `DROP POLICY`, `REVOKE`, `GRANT`). Executed by a DB admin / migration runner role, not by `SUPABASE_SERVICE_ROLE_KEY` in Next.js. |
| 2 | Or does **application code** require elevated access **after** the migration? | **Yes.** After policies that allow anon/authenticated are removed, browser/anon PostgREST to `app_data_store` fails. Apps that read/write the store via PostgREST must use a role that can still access the table — today that is **service_role** (bypasses RLS). |
| 3 | Why does each app allegedly need the key? | **inspection-center** and **bgs-policy-compliance** upsert/select JSON blobs in `app_data_store` through `createServerSupabaseClient()`. **inspect-mn (portal)** does **not** need the service role for that store for embed signing; it needs embed HMAC secrets separately. Portal may still use service role for other features (guidance, reports) unrelated to this migration. |
| 4 | Can dependency be limited to one protected server route/worker? | **Partially.** All remote store I/O already goes through server modules (`remote.ts` / `local-store` remote path). Could further narrow to a single internal worker, but **today** many server actions/API routes call the store helpers. Not required for IC-D01/D05. |
| 5 | Can authenticated user + RLS replace service role? | **Not with current schema.** One shared JSON row per key has no `organization_id` column for RLS predicates (P0-03). User-scoped RLS would need schema redesign first. |
| 6 | Narrow reviewed RPC instead of broad elevated API? | **Yes, future option:** `SECURITY DEFINER` RPCs that only upsert specific keys with app checks. Not in this P0 IC batch. |
| 7 | What fails if embed secret is absent? | Portal cannot mint tokens; modules cannot verify tokens → no signed scope. **After IC-D05:** mutations fail closed. **Before IC-D05:** missing embed meant **open write**. Soft-mint (IC-D01) could still mint if a signing key exists (on `master`, hardcoded fallback supplies one). |
| 8 | Can secret-dependent feature fail independently? | **Yes.** Embed is an iframe trust boundary. Portal login/RBAC can remain up while embeds fail closed. After IC-D05, inspection writes require valid embed — intentional isolation. |

## Environment variable matrix

| Variable | File:line (evidence) | App | Side | Used by | Purpose | Missing behavior | Build | Runtime | Migration exec | Bypasses RLS? | User+RLS alternative? |
|----------|----------------------|-----|------|---------|---------|------------------|-------|---------|----------------|---------------|----------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | `inspection-center/src/lib/supabase/server.ts` (Batch1 & master: `getRemoteStoreServiceRoleKey`) | inspection-center | Server | `createServerSupabaseClient` → remote store | Read/write `app_data_store` | Client null → local/tmp only; remote save no-ops/fails | No | Yes (remote persist) | No | Yes (role bypass) | Not with mega-JSON |
| `SUPABASE_SERVICE_ROLE_KEY` | `bgs-policy-compliance/src/lib/supabase/server.ts` | policy | Server | remote store | Same | Same | No | Yes | No | Yes | Same |
| `NEXT_PUBLIC_SUPABASE_URL` | same server modules | inspection + policy | Server (name is public) | createClient URL | Project URL | Client null | No | Yes | No | No | N/A |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **not** accepted for store after Batch1 server.ts | — | — | — | Was fallback on older code | — | — | — | — | Would hit RLS | Should not write store |
| `INSPECTION_EMBED_SECRET` | `inspection-center/src/lib/access/embed.ts` `signSecret`/`verifySecrets` | inspection-center | Server (middleware + RSC) | HMAC embed | Verify/sign scope | Verify fails; sign returns null | No | Yes (embed) | No | No | N/A |
| `POLICY_EMBED_SECRET` | same + portal `embed-secret-config.ts` (Batch1) | portal + modules | Server | HMAC | Sign/verify policy & fallback inspection | Sign null / verify fail | No | Yes (embed) | No | No | N/A |
| `*_EMBED_SECRET_PREVIOUS` | Batch1 verify lists | portal + modules | Server | Rotation | Verify old tokens | Rotation only | No | Optional | No | No | N/A |
| `INSPECTION_ALLOW_UNSCOPED_WRITES` | **new** (IC-D05 local escape) | inspection-center | Server | write-access gate | Explicit local QA only | Default deny | No | Optional | No | No | N/A |

## Claim correction

**Prior claim (too broad):** “RLS migration requires service-role + embed secret on **all** apps.”

**Evidence-based claim:**
- **Migration apply:** needs DB privileged migrator — **not** the Next.js service-role env var.
- **Post-migration remote JSON store:** inspection-center + policy apps need **server-side** `SUPABASE_SERVICE_ROLE_KEY` (or a future RPC) or remote persistence breaks.
- **Embed secrets:** required for **portal→iframe trust**, independent of RLS. Portal + each module that verifies tokens need the HMAC secret(s). Not required to *execute* the SQL file.
- **IC-D01/IC-D05 fixes:** application code only; **do not require** applying P0-01 migration or rotating embed secrets.

## Client bundle check (method)

- Service role is read only via `process.env.SUPABASE_SERVICE_ROLE_KEY` in **server** modules (`"server-only"` pattern via Route Handlers / store / no `NEXT_PUBLIC_` for the key).
- Confirm after `next build`: search `.next` for `service_role` / literal key material — see `15-p0-test-results.md`.
- `/api/runtime-info` (Batch1, **not** on this branch) is designed to expose **booleans**, not secret values — still excluded from this branch.

## Key migration (future, not this batch)

Moving off broad service-role store access → org-scoped schema or narrow RPC is a **separate** security task (P0-03 / later). This P0 IC batch does not change key strategy.
