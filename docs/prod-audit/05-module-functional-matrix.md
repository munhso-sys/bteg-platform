# 05 — Module Functional Matrix

Legend: **OK** works when env+data present · **DEGRADED** partial · **BROKEN** expected failure mode · **RISK** works but unsafe

## Portal shell (`inspect-mn` / `bteg.inspect.mn`)

| Function | Local | Production | Notes |
|----------|-------|------------|-------|
| Login / logout | OK | OK/DEGRADED | Timeout→login (P1-04); SMTP limits if custom SMTP missing |
| Access request form | OK | OK | anon INSERT policy |
| Approve invite | DEGRADED without service role | needs `SUPABASE_SERVICE_ROLE_KEY` | admin routes |
| Settings / users | OK | OK with admin+service role | |
| Dashboard KPIs | OK | DEGRADED if modules down | depends on embeds/APIs |
| Runtime health | `/api/supabase/health` | OK | exposes URL presence, not secrets |

## Хяналт шалгалт (`/inspection` → inspection-center)

| Function | Local | Production | Notes |
|----------|-------|------------|-------|
| Iframe load | localhost:3001 | `NEXT_PUBLIC_INSPECT_URL` | wrong URL → blank |
| Embed scope token | signed | **RISK** if hardcoded secret | P0-02 |
| Runs CRUD | local JSON | remote `inspection_center_store` | P1-01 |
| Findings views | in-memory over store | same | no SQL FK |
| Corrective actions | JSON | JSON | same |
| Unit filter | JS | JS | not RLS |

## Журмын биелэлт (`/policy-compliance` → bgs-policy-compliance)

| Function | Local | Production | Notes |
|----------|-------|------------|-------|
| Iframe load | :3002 | policy Vercel URL | |
| Positions / policies | local `data/` | `policy_compliance_db` when `VERCEL` | missing data → 500/hang historically |
| Clause links | JSON responsibilities | remote gzip possible | large payload |
| Official position code | code path in repo | requires module redeploy | Git≠auto Vercel (P1-02) |

## Судалгаа хөгжүүлэлт (`/development`)

| Function | Local | Production | Notes |
|----------|-------|------------|-------|
| Iframe | :3003 | development Vercel app | separate deploy lifecycle |
| Auth middleware | none found | none | P1-09 |
| Persistence | `localStorage` (`rd-program-initiatives-v1`) | browser-local only | not shared across users/devices; Supabase client unused |

## Ажилтны дуу хоолой / AI / Risk / Reports / SmartMine / Guidance

| Module | Storage | Prod dependency |
|--------|---------|-----------------|
| Employee voice | `app_data_store` + Telegram | bot token, webhook public API |
| AI assistant | OpenAI + store facts | `OPENAI_API_KEY`; may read inspection store |
| Risk | store payloads / inspection signals | inspection store key |
| Reports | builds from profiles + stores | cron secret |
| SmartMine | **other** Supabase project | `SMARTMINE_*` |
| Guidance | `app_data_store` | service role writes in prod |
| Policy review | OpenAI + store fallback | |

## Expected prompt routes vs actual

| Prompt | Actual |
|--------|--------|
| `/compliance` | `/policy-compliance` |
| `/research` | `/development` |
| `/voice` | `/employee-voice` |
| `/ai` | `/ai-assistant` |

## Persistence after reload / new deploy

- Relational RBAC: persists in Postgres.
- Module JSON: persists in `app_data_store` **if** remote writes succeeded.
- Local-only edits never reach production.
- New Vercel deploy without Git-linked module project → old module bundle (P1-02).
- Stale data: last writer wins on single JSON key; concurrent edits → lost updates unless conditional upsert used (policy has conflict helper; inspection upsert is unconditional).

## Unauthorized access

- Portal pages: middleware gate.
- Direct module URLs: may be reachable without portal chrome; must enforce own auth/embed validation (verify each module middleware).
- Direct PostgREST to `app_data_store`: **open** (P0-01).
