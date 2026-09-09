# 09 — Observability Gaps

## Current gaps

- Rely on `console.warn` for remote store failures (easy to miss in Vercel logs).  
- No standard `request_id` propagation.  
- No structured fields for organization/unit, entity ids, or DB error codes.  
- Embed/auth timeouts fail silently to null.  
- No `/api/runtime-info` for commit/deployment/project ref parity.  
- Cron `/api/reports/distribute` needs success/failure metrics.

## Recommended structured log fields

| Field | Notes |
|-------|-------|
| `request_id` | UUID per request |
| `deployment_id` | `VERCEL_DEPLOYMENT_ID` |
| `commit_sha` | `VERCEL_GIT_COMMIT_SHA` |
| `route` | pathname / route id |
| `operation` | e.g. `store.load`, `auth.getUser` |
| `entity_type` | `finding`, `access_request`, … |
| `entity_id` | opaque id |
| `organization_id` / `heltes_id` | unit scope when known |
| `user_ref` | hashed user id, not email |
| `db_error_code` | PostgREST/Postgres code |
| `duration_ms` | |
| `status` | ok/error/timeout |

## Never log

- Access tokens, refresh tokens, cookies  
- Passwords, invite links with tokens  
- `SUPABASE_SERVICE_ROLE_KEY`, embed secrets, bot tokens, OpenAI keys  
- Full `app_data_store` payloads / PII-rich records  

## Proposed safe runtime endpoint

`GET /api/runtime-info` (authenticated admin or public limited):

```json
{
  "app": "inspect-mn",
  "version": "0.1.0",
  "commitSha": "597d1ff…",
  "deploymentId": "dpl_…",
  "vercelEnv": "production",
  "supabaseProjectRefMasked": "umsw…syct",
  "schemaVersion": "portal-rbac-20260815"
}
```

No keys, no emails, no payloads.

## Vercel + Supabase

- Enable Vercel log drains if available.  
- Track function duration for middleware-heavy paths.  
- Supabase: monitor `app_data_store` row sizes and auth error rates.  
