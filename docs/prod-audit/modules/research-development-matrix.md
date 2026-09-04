# Research & Development (`development`) — action matrix & defects

App: `development` · Portal: `/development` · **No `middleware.ts`**

## Auth / client

| Concern | Behavior |
|---------|----------|
| Auth | None at module boundary |
| Supabase | `lib/supabase/client.ts` stub exists; **unused** by features |
| Persistence | `localStorage` keys `rd-research-projects`, program initiatives key |
| Org scope | none |
| RLS | N/A |
| Audit | none |
| Cache | N/A (client memory + localStorage) |

## Route map

| Route | Purpose |
|-------|---------|
| `/`, `/dashboard` | Overview |
| `/projects` | Research projects CRUD (client) |
| `/program` | Program initiatives board |
| `/results`, `/reports`, `/feedback`, `/settings` | Mostly static/light UI |

## Action matrix

| page/route | role | action | validation | API | client | storage | mutated | FKs | org | RLS | success | error | cache | UI | audit | tests |
|------------|------|--------|------------|-----|--------|---------|---------|-----|-----|-----|---------|-------|-------|-----|-------|-------|
| `/projects` | any browser | Create/edit project | modal fields (loose) | none | React state | `localStorage` `rd-research-projects` | full array | none | none | n/a | closes modal | ignore parse errors | n/a | setState | none | none |
| `/projects` | any | Delete | confirm in modal | none | state | localStorage | filter id | none | none | n/a | closes | — | n/a | setState | none | none |
| `/program` | any | Save initiative | modal | none | hook | localStorage program key | items[] | none | none | n/a | closes | ignore | n/a | setState | none | none |
| `/program` | any | Delete / cycle quarter | click | none | hook | localStorage | items | none | none | n/a | UI | — | n/a | setState | none | none |
| theme | any | Toggle | — | none | localStorage theme | — | — | — | n/a | — | — | n/a | classList | none | none |

## Lifecycle verdict

| Step | Result |
|------|--------|
| create → list → detail → edit | Works **in same browser profile only** |
| status transition | Project status field in modal |
| child records | KPI derived client-side; no server children |
| reload | Same browser: OK; other device: seed/empty |
| logout/login | Portal logout does **not** clear module localStorage; another user on same browser sees prior data (**RD-D02**) |

## Negative cases

| Case | Actual |
|------|--------|
| Missing required | Weak; can save sparse objects |
| Invalid ID | Client-only |
| Deleted parent | N/A |
| Unauthorized | **No check** |
| Other organization | **No isolation** |
| Expired session | Module still usable if URL opened |
| Double submit | State race possible |
| Network/DB | N/A — never hits DB |
| Stale after deploy | localStorage schema drift possible |

## Defects

### RD-D01 — No server persistence / no auth (P0)
- **Repro:** Create project on PC-A; open production on PC-B → seed data, not user data.  
- **Evidence:** `ProjectsClient.tsx` L36–67; `program-store.ts`; no middleware.  
- **Minimal fix (product choice):** Either (a) mark module “local prototype only” in UI, or (b) persist to `app_data_store` with service role + portal embed auth like siblings.  
- **Test:** After (b), create→reload on second profile persists; unauthorized embed denied.

### RD-D02 — Cross-user browser leakage (P0)
- **Repro:** User A creates projects; logout; User B logs into portal; opens `/development` same browser → sees A’s localStorage.  
- **Minimal fix:** Namespace storage by `user_id` from embed/portal; clear on logout message; or move to server.  
- **Test:** Storage key includes user id; logout clears.

### RD-D03 — Supabase client dead code (P3)
- Unused browser client confuses contracts. Remove or wire intentionally.

### RD-D04 — No tests (P3)
