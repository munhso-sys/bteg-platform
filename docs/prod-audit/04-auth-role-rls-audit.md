# 04 — Auth, Role, and RLS Audit

## Auth pipeline

| Piece | Path | Behavior |
|-------|------|----------|
| Middleware | `inspect-mn/src/middleware.ts` | Delegates to `updateSession` |
| Session refresh | `inspect-mn/src/lib/supabase/middleware.ts` | Cookie get/set via `@supabase/ssr` |
| Browser client | `lib/supabase/client.ts` | `createBrowserClient` |
| Server client | `lib/supabase/server.ts` | Request cookie store; setAll may no-op in RSC |
| Admin client | `lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` (server-only) |

### Protected route matching

Matcher: all paths except static assets. Public exceptions:

- `/login`, `/access-request`, `/forgot-password`, `/update-password`, `/auth/*`
- Public APIs: `/api/supabase/health`, `/api/org/options`, `/api/access-requests`, `/api/auth/forgot-password`, `/api/modules/*`, `/api/reports/distribute`, `/api/telegram/voice-webhook`

Unauthenticated users redirect to `/login?next=…`.

### Timeout / failure semantics (P1)

`getUserWithTimeout` races `getUser()` against 8s timer; on timeout or catch returns `null` → **treated as logged out**. Evidence: `middleware.ts` lines 7–21, 74–78. Production latency (Vercel region vs `ap-southeast-2`) can cause false logouts.

### Session storage

Clients are request-scoped factory functions (good). No module-level user session cache found in supabase clients. Browser client is per-call `createClient()`.

### getSession vs getUser

Middleware and most APIs use `getUser()`. `update-password` page uses `getSession()` (weaker if unverified). Prefer `getUser()` for authorization.

## Roles (actual application roles)

From `inspect-mn/src/lib/rbac/types.ts` (not ADMIN/INSPECTOR/MANAGER labels):

| RoleId | Notes |
|--------|-------|
| `admin` | Portal admin |
| `leadership` | Leadership |
| `dxsh_head` / `dxsh_specialist` | DXSH |
| `unit_manager` / `senior_specialist` | Unit findings scoped |
| `specialist` / `junior_specialist` | Position-scoped policy |
| `employee` / `assistant` | Position-scoped |

Permissions are `module.*.view|edit`, `portal.admin`, `portal.settings`, etc.

## Access matrix (expected intent)

| Capability | admin | dxsh_* | unit_manager | specialist/employee | anon |
|------------|-------|--------|--------------|---------------------|------|
| Login | Y | Y | Y | Y | N |
| Settings admin | Y | limited | N | N | N |
| Approve access requests | Y (+ service role) | per policy | N | N | N (insert request only) |
| Module nav | by `role_permissions` | by grants | unit inspection view | by grants | N |
| Read `app_data_store` via Data API | **Y (all keys)** | **Y** | **Y** | **Y** | **Y** |
| Write `app_data_store` via Data API | **Y** | **Y** | **Y** | **Y** | **Y** |

The last two rows are **policy bugs** (P0-01), not product intent. Application code often uses service role for writes, but RLS still allows anon/authenticated direct PostgREST access.

## Embed token trust boundary (P0-02)

Portal signs iframe claims with HMAC. Secret resolution:

```text
POLICY_EMBED_SECRET || "inspect-platform-policy-embed-v1" || SERVICE_ROLE
```

Because the literal string is always truthy, **service role is never used as signer**, and any environment without `POLICY_EMBED_SECRET` shares a **publicly knowable** secret once source is visible. Same pattern in `inspection-embed-server.ts` with additional `INSPECTION_EMBED_SECRET` preference.

Impact: forged `mode: "full"` claims can over-privilege embedded modules if they trust the token.

## Organization boundary

- Profiles carry `heltes_id` / `alba_id` text fields.
- Unit scope helpers filter in application code.
- **P0/P1:** No RLS predicate on store keys by unit. Anyone who can read `app_data_store` sees all units’ inspection/policy JSON.
- Cross-organization visibility via open RLS = **P0**.

## Caching of authenticated responses

Many API routes set `export const dynamic = "force-dynamic"`. Middleware runs on most paths. Residual risk: CDN caching of authenticated HTML if misconfigured — not evidenced in `vercel.json`. Avoid sharing cache tags without `user_id`.

## Advisors (security)

- Anon can execute SECURITY DEFINER `is_portal_admin`, `update_own_profile_contact`
- Leaked password protection disabled

## Recommendations (not implemented)

1. Lock `app_data_store` to service_role only (or authenticated + key allowlist + deny anon).
2. Require strong embed secrets; remove hardcoded fallback; rotate.
3. Replace auth timeout logout with fail-open retry or sticky session + metrics.
4. Revoke anon EXECUTE on definer RPCs unless intentionally public.