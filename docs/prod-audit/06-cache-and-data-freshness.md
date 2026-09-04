# 06 — Cache and Data Freshness

## Next.js cache configuration

- `inspect-mn/next.config.ts`: no `cacheComponents`, no custom `experimental` cache flags.
- Many portal API routes export `dynamic = "force-dynamic"`.
- No widespread `unstable_cache` / `"use cache"` found in portal for auth-bound data (spot check).
- Inspection-center uses `revalidatePath` for plan-related mutations; findings helpers import `revalidateFindingsPaths`.

## Auth and caching

Middleware runs on nearly all routes and refreshes cookies. Risk of caching authenticated HTML at CDN is low if `force-dynamic` / no-store defaults hold — still validate per route for Server Components without dynamic markers.

## Mutation → freshness flows

### Pattern A — RBAC / access requests (portal)

1. Mutation via admin Supabase client  
2. JSON response to client  
3. Often `router.refresh()` or page reload in UI  
4. No tag-based cache  
**Risk:** UI lists stale until refresh if client state not updated.

### Pattern B — inspection / policy JSON store

1. Read entire payload  
2. Mutate in memory  
3. Upsert whole payload to `app_data_store`  
4. Optional `revalidatePath`  
**Risks:**
- Concurrent writers overwrite each other (lost update) unless conditional update (policy remote has `saveRemotePayloadIfMatch`; inspection `saveRemotePayload` is unconditional).
- Embed iframe may not receive portal `router.refresh`.
- Local FS vs remote: production may show older remote while local shows new file.

### Pattern C — iframe modules

Portal loads module origin in iframe. Cache invalidation inside child app does not update sibling modules consuming the same store key (e.g. AI/risk reading `inspection_center_store`).

## Stale-data root causes (prod-specific)

1. Deployed portal points to new code but module app not redeployed.  
2. `preferRemoteStore()` false locally / true on Vercel → different sources of truth.  
3. Open RLS allows out-of-band writes.  
4. Gzip remote policy payload decode failure → warn + null → empty UI.  
5. Middleware false logout mid-session → user thinks data “lost”.

## Recommended smallest cache policies (do not implement now)

| Route class | Policy |
|-------------|--------|
| Auth pages | dynamic, no store |
| Settings admin | dynamic |
| Dashboard KPI APIs | dynamic or short `revalidate` with user-scoped keys only if added |
| Module iframes | cache-control on HTML short; data via API no-store |
| Public health | can be static/short ISR |

Do **not** globally disable caching as a fix. Prefer per-mutation `revalidatePath` inside the owning module + document store version/etag for multi-writer keys.