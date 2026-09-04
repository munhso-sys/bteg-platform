# 02 — Code-to-Database Contract Map

## Canonical data model (confirmed)

Production `inspect-bteg` has **no** tables named `inspections`, `findings`, `corrective_actions`, `organizations`, `departments`, `compliance_items`, or `research_projects`.

Business entities are either:

- **RBAC tables** (relational), or
- **JSON documents** in `public.app_data_store` (`key` PK, `payload` jsonb, `updated_at`).

### Relational tables used by portal code

| Table | Client type | Typical ops | Org scope |
|-------|-------------|-------------|-----------|
| `user_profiles` | user SSR / admin | select/upsert | heltes/alba columns on profile, not org FK |
| `roles` | user SSR | select | global catalog |
| `permissions` | user SSR | select | global |
| `role_permissions` | user SSR / admin | select | global |
| `access_requests` | anon insert; admin update | CRUD | unit fields as text IDs |
| `temporary_edit_grants` | user SSR / admin | select/write | heltes/alba optional |
| `app_data_store` | user SSR and/or admin | select/upsert by key | **none at DB** |

### Known `app_data_store` keys (from code)

| Key | Owner app / module |
|-----|--------------------|
| `inspection_center_store` | inspection-center primary store (runs, findings, actions in JSON) |
| `inspection_center_annual_plans` | inspection-center |
| `inspection_center_annual_plan_types` | inspection-center |
| `inspection_center_master` | inspection-center |
| `inspection_center_org_template_allocations` | inspection-center |
| `policy_compliance_db` | bgs-policy-compliance |
| `policy_compliance_position_org_overrides` | policy |
| `policy_compliance_policy_org_overrides` | policy |
| `policy_compliance_org_catalog_overrides` | policy |
| Additional portal keys | voice, guidance, risk, telegram, session, AI scope, report distribution, policy-review (see `inspect-mn/src/lib/**/store*.ts`) |

Evidence: `inspection-center/src/lib/store/remote.ts`, `bgs-policy-compliance/src/lib/db/remote-store.ts`, portal store modules.

## inspections → findings → corrective_actions

| Expectation | Actual |
|-------------|--------|
| Child tables with FKs | **Absent** in Postgres |
| Nested queries / PostgREST embeds | N/A |
| Indexes on FK columns | N/A |
| ON DELETE behavior | Application-defined inside JSON mutation helpers |
| Filtering | Mostly **in-memory** after loading full store (`inspection-center/src/lib/access/scope.ts` filters `data.findings`) |

**Implication:** schema-cache “relationship” errors for these names would mean callers assume a relational API that was never migrated. Local success comes from filesystem JSON; production success requires remote blob + permissive RLS or service role.

## Contract matrix (minimum coverage)

### Authentication / logout

| Layer | Detail |
|-------|--------|
| Route | `/login`, `/auth/callback`, logout button |
| Client | Browser `createBrowserClient` |
| Server | Middleware `getUser()` with 8s timeout |
| Tables | none for session; profile optional |
| Cache | Cookie-based; middleware refreshes |

### Dashboard

| Layer | Detail |
|-------|--------|
| Route | `/`, `/api/me/dashboard-kpis` |
| Data | Aggregates from module APIs / stores / profiles |
| Risk | Multiple sequential fetches; inspection KPI may pull large JSON |

### Inspection list/create/detail

| Layer | Detail |
|-------|--------|
| Portal | `/inspection` iframe → `NEXT_PUBLIC_INSPECT_URL` + embed token |
| Module | `inspection-center` App Router pages (`/dashboard`, `/runs`, `/findings`, `/actions`, …) |
| Persistence | Local JSON **or** `app_data_store` key `inspection_center_store` |
| Supabase client | Module server client; upserts to store |
| RLS | Currently open (true) — see P0-01 |
| Cache | `revalidatePath` on some plan mutations; findings cache helpers |

### Findings / corrective actions

| Layer | Detail |
|-------|--------|
| UI | `/findings/*`, `/actions/*` inside inspection-center |
| DB | Arrays inside store payload (`InspectionFinding`, actions types in `lib/types`) |
| Scope | JS filter by unit/role after load |

### Compliance (policy)

| Layer | Detail |
|-------|--------|
| Portal | `/policy-compliance` iframe |
| Module | `bgs-policy-compliance` |
| Persistence | Local `db.json` unless `preferRemoteStore()` (`VERCEL` or `USE_REMOTE_STORE=1`) → `policy_compliance_db` |
| Tables | Policies/clauses/positions are **JSON collections**, not SQL tables in portal DB |
| Separate schema | `bgs-policy-compliance/supabase/migrations/*.sql` exists in Git but is **not** the live portal project schema inventory |

### Research / development

| Layer | Detail |
|-------|--------|
| Portal | `/development` iframe |
| Module | `development` app on separate Vercel project |

### Role-based access (portal)

| Layer | Detail |
|-------|--------|
| Types | `RoleId` / `PermissionId` in `inspect-mn/src/lib/rbac/types.ts` |
| Lookup | `user_profiles.role_id` → `role_permissions` → `permissions` |
| Module gate | `MODULE_VIEW_PERMISSION` map |
| Temporary edit | `temporary_edit_grants` |

### Organization isolation

| Layer | Detail |
|-------|--------|
| Model | Text unit IDs (`heltes_id`, `alba_id`) on profiles/requests |
| Enforcement | Application (`unit-scope.ts`, embed claims, module scope filters) |
| DB RLS | **Does not** partition `app_data_store` by unit |

## Anti-patterns found

1. **Fetch-all-then-filter-in-JS** — inspection findings scoping after full store load.
2. **Monolithic select** — `select("payload, updated_at").eq("key", …)` loads entire module DB.
3. **Swallowed remote errors** — `console.warn` + return null/false (`remote.ts`, `remote-store.ts`) can look like empty data.
4. **Hardcoded embed secret** — predictable signing key (P0-02).
5. **Admin fallback** — `hasServiceRole() ? createAdminClient() : createClient()` in RBAC helpers changes behavior when service role missing.
6. **Double Supabase projects** — SmartMine vs portal without compile-time guard.

## Undefined / missing relational queries

Any code or docs assuming PostgREST tables `inspections` / `findings` / `corrective_actions` against `inspect-bteg` will fail with relation-does-not-exist or schema-cache errors. Confirm callers before designing FK migrations.