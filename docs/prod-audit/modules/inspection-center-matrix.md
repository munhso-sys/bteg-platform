# Inspection Center — action matrix & defects

App: `inspection-center` · Portal embed: `/inspection` · Store key: `inspection_center_store` (+ plans/master/org-template keys)

## Auth / client

| Concern | Behavior |
|---------|----------|
| Middleware | `src/middleware.ts` — embed JWT cookie/header; **also soft-mints unit token from query** |
| Write gate | `requireInspectionWriteAccess()` on mutating APIs |
| Supabase client | Server `createServerSupabaseClient()` → **service role only** (Batch 1) for `app_data_store` |
| SQL tables | none for runs/findings/actions |
| Logical FKs | `finding.runId`, `finding.answerId`, `action.findingId`, evidence refs |
| Org scope | Embed `mode: unit|full`; in-memory filter in `lib/access/scope.ts` |
| RLS | N/A on JSON; table RLS on `app_data_store` (Batch 1 lock) |
| Audit log | none dedicated |

## Route map

| Route | Purpose |
|-------|---------|
| `/dashboard` | KPIs |
| `/runs`, `/runs/new`, `/runs/[id]` | Inspection runs lifecycle |
| `/findings`, `/findings/state|night|joint` | Findings views |
| `/actions`, `/actions/open`, `/actions/resolved` | Corrective actions |
| `/plans`, `/plans/annual`, `/plans/by-type`, `/plans/gaps` | Plans |
| `/templates`, `/templates/[id]` | Templates |
| `/evidence`, `/analytics`, `/imports`, `/master-sheets` | Support |
| `/settings`, `/settings/org-templates`, `/settings/org-policies` | Settings |

## Action matrix (core lifecycle)

| page/route | role (embed) | button/form/action | validation | server/API | client | table/view/RPC | columns/payload | expected FKs | org scope | RLS | success | error | cache | UI refresh | audit | tests |
|------------|--------------|-------------------|------------|------------|--------|----------------|-----------------|--------------|-----------|-----|---------|-------|-------|------------|-------|-------|
| `/runs/new` | full write | Create run server action | template/plan fields in action | `"use server"` in page | FS/remote store | — | `runs[]` append | templateId | unit blocked for `/runs/new` | store | redirect | catch message | revalidate runs | navigation | none | none |
| `/runs/[id]` | full/unit | Score form POST | answer payload | `/api/runs/[id]/answers` | store | — | answers/scores | runId | filtered | store | JSON | 4xx | revalidate | client state | none | none |
| `/runs/[id]` | full/unit | Create finding+action | `answerId` required | `POST .../findings` | store | — | finding+action | runId, answerId, findingId | write gate | store | JSON `{finding,action}` | 400 | revalidate runs/findings/actions/dashboard | form | none | none |
| `/actions/*` | full/unit | Status mutations | action id | `actions/mutations.ts` server | store | — | action.status | findingId | write gate | store | ok | throw | revalidateActionsPaths + dashboard | router | none | none |
| `/plans/*` | full | Plan edits | plan shape | `plans/actions.ts` / by-type-save | store + annual keys | — | plans JSON | — | write | store | ok | warn | revalidatePath plans/runs | refresh | none | none |
| `/templates` | full | CRUD sections/questions | ids | server actions on pages | store | — | templates tree | parent ids | write | store | ok | — | revalidate templates | refresh | none | none |
| settings reset | admin-ish | Data reset client | confirm | API/settings | store | — | wipe/seed | — | — | store | ok message | error UI | revalidate | reload | none | none |

## Lifecycle verdict

| Step | Result |
|------|--------|
| create → list → detail → edit | Works on local store; prod needs remote hydrate |
| status transition (actions) | Supported via mutations |
| child finding/action | Created together from answer |
| reload | Local OK; prod depends on remote flush succeeding |
| logout/login | Portal session; module relies on embed re-issue |

## Negative cases

| Case | Actual |
|------|--------|
| Missing required field | Often 400 JSON; some server actions may throw uncaught |
| Invalid ID | Store helpers throw / return undefined — uneven |
| Deleted parent | Cascade in store for some deletes; not DB FK |
| Unauthorized | Write APIs gated; **read** may be open without embed |
| Other org/unit | Soft query mint (IC-D01) can impersonate unit labels |
| Expired embed | verify returns null → falls through |
| Double submit | No idempotency keys on findings POST |
| Network/DB error | **Silent** remote warn (IC-D02) |
| Stale after deploy | Hydrate TTL 60s; multi-instance last-write-wins |

## Silent success risks

1. `scheduleRemoteWrite` / `.catch(console.warn)` after in-memory commit (`lib/store/index.ts` ~173–177).  
2. `saveRemotePayload` returns `false` on error — callers of schedule path ignore boolean.  
3. Scoring forms `res.json().catch(() => null)` — may treat parse failure as empty success path depending on UI.

## Defects

### IC-D01 — Soft unit token mint (P0)
- **Repro:** Open `https://<inspection-host>/dashboard?scope=unit&heltes_id=X&heltes_name=Foo` without portal `embed`.  
- **Expected:** Reject unsigned scope.  
- **Actual:** Middleware signs token server-side (`mintSoftUnitToken`, `middleware.ts` L34–48, L72–78).  
- **Root cause:** Trusts query params to mint HMAC.  
- **Minimal fix:** Remove soft mint; require portal-signed `embed` only.  
- **Regression test:** Middleware/unit test: `scope=unit` without embed → no cookie / 401 redirect.

### IC-D02 — Silent remote write failure (P1)
- **Repro:** Break service role; create finding; UI shows finding; reload empty/stale.  
- **Evidence:** `lib/store/index.ts` L173–177; `remote.ts` save returns false + warn.  
- **Minimal fix:** Surface write failure to API response; fail the request if remote preferred and save fails.  
- **Test:** Mock `saveRemotePayload` false → POST findings returns 5xx.

### IC-D03 — Unconditional remote upsert races (P2)
- **Evidence:** `saveRemotePayload` no etag; policy module has `IfMatch`.  
- **Minimal fix:** Conditional upsert like policy store.  
- **Test:** Concurrent write simulation.

### IC-D04 — No automated lifecycle tests (P3)
- Only `test:scoring`. Add Playwright create→finding→action→reload.

### IC-D05 — Fail-open writes without embed (P0)
- **Repro:** Open inspection-center with no `embed` cookie/header; `PATCH /api/runs/:id/answers`.  
- **Expected:** 401/403 in production.  
- **Actual:** `requireInspectionWriteAccess` only blocks `mode === "unit"`; null scope = full write. Portal timeout can iframe without token.  
- **Evidence:** `lib/access/scope.ts` (~211–226, `isInspectionAdmin` ~250–255); portal embed fallback empty query.  
- **Minimal fix:** Require signed `mode: "full"` (or explicit role) for mutations; deny null scope when `VERCEL`/prod.  
- **Regression test:** No scope → 403; unit → 403; full → 200.

### IC-D06 — Unit IDOR on run detail / evidence (P1)
- **Repro:** Unit embed; open `/runs/{foreignId}` or `/evidence`.  
- **Expected:** 404 / filtered.  
- **Actual:** List filtered; detail uses unscoped `readStore()` by id.  
- **Evidence:** `runs/[id]/page.tsx`; `evidence/page.tsx` vs scoped list on `runs/page.tsx`.  
- **Minimal fix:** Apply `readScopedStore` / template allowlist; `notFound()` if out of scope.  
- **Test:** Unit token + foreign run id → 404.

### IC-D07 — Flush timeout still returns success (P1)
- **Evidence:** `flushPendingStoreWrites` clears pending on timeout; scoring UI treats HTTP OK as persisted.  
- **Minimal fix:** Return `persisted:false` / 503 if remote not confirmed when remote preferred.  
- **Test:** Mock slow `saveRemotePayload` → non-success contract.

### IC-D08 — `/settings/data` nav 404 (P2)
- **Evidence:** `settings/nav.ts` links to `/settings/data`; `DataResetClient` exists; no `app/settings/data/page.tsx`.  
- **Minimal fix:** Wire page + admin gate, or remove nav item.  
- **Test:** GET `/settings/data` → 200 or nav absent.

### IC-D09 — Settings thresholds skip `runStoreMutation` (P2)
- **Evidence:** `settings/page.tsx` → `setRiskThresholds` / `writeStore` without await flush wrapper.  
- **Minimal fix:** Wrap in `runStoreMutation`.  
- **Test:** Save thresholds awaits remote when configured.

### IC-D10 — Embed query dropped on plain Links (P3)
- **Evidence:** Some `Link` targets omit `EmbedLink`/`withEmbed` (run detail, settings subnav).  
- **Minimal fix:** Prefer `EmbedLink` everywhere for iframe navigations.  
- **Test:** Cookies blocked; embed query preserved across nav.