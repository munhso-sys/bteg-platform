# 07 — Performance Findings

## Architecture-driven costs

1. **Monolithic JSON documents**  
   Each module page that needs data loads a full `app_data_store` payload (inspection store / policy DB). No SQL pagination. As data grows, every navigation pays full deserialize cost.

2. **In-memory aggregation**  
   Findings dashboards filter/group in Node after load (`live-sidebar-dashboard.ts`, scope filters). CPU scales with array size, not indexed queries.

3. **Cross-region latency**  
   - Supabase `inspect-bteg`: `ap-southeast-2`  
   - Observed Vercel builds historically in `iad1` (Washington)  
   Every `getUser()` and store round-trip pays intercontinental RTT → compounds middleware 8s timeout risk.

4. **Iframe architecture**  
   Portal + 3 duty apps = multiple cold starts, duplicate auth/embed work, separate bundles.

5. **Sequential dependent work**  
   Profile → permissions → module ready → embed token → iframe load. Opportunity to parallelize independent fetches.

## Database advisor (performance)

- Unindexed FKs on access_requests, role_permissions, temporary_edit_grants, user_profiles.role_id  
- Auth RLS initplan warnings (wrap `auth.uid()` in `(select auth.uid())`)  
- Multiple permissive policies on `temporary_edit_grants` SELECT  
- Unused indexes on access_requests (status, email) — may become used later; don’t drop blindly  
- Auth DB connections absolute (10) vs percentage strategy

## N+1 / loops

- Portal RBAC: typically few queries per request (profile + role_permissions) — acceptable.  
- Risk when looping users with per-user queries in admin reports — review `reports/build.ts` if slow.  
- Inspection: not classic SQL N+1; equivalent is repeated full-store loads per request without request-level memoization.

## Counts and payloads

- Exact SQL `count(*)` rare; UI counts from in-memory arrays.  
- Policy remote may gzip large DB; decode CPU on each cold load.

## Client bundles

- Portal embeds heavy modules as separate apps (good isolation) but portal still includes SmartMine, pdfmake, docx dependencies — watch main bundle for settings/AI routes.

## Timeouts

- Auth middleware: 8s  
- Inspection embed build: 8s (`EMBED_BUILD_TIMEOUT_MS`)  
Timeouts surface as empty scope / login redirect rather than explicit 504 UX.

## Index recommendations (only with query evidence)

For current relational workload, prioritize:

1. `user_profiles(role_id)` — FK join in permission resolution  
2. `access_requests(status)`, `(email)` — already exist but advisor marks unused; keep until traffic proves otherwise  
3. **Do not** invent indexes for findings tables that do not exist — first decide relational vs JSON strategy.

For JSON store, performance fix is **not** a B-tree on jsonb alone; consider splitting keys by unit/year or moving hot entities to tables.

## Observability needed for proof

- Vercel function duration p95 by route  
- Supabase query time for `app_data_store` select by key  
- Payload byte sizes per key (measure in controlled admin tooling; not dumped in this audit)  
- Middleware auth latency histogram  
