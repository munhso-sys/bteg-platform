# 41 — Preview and production rollout order

**Branch:** `fix/prod-stabilization-p0` @ `3f041aa` + uncommitted P0-03  
**Production Supabase:** `umswlpkjiwjohkolsyct` (protected — no Preview writes)  
**Prerequisite:** Human creates Preview/staging Supabase or confirms isolated project ref.

---

## Phase 0 — Pre-flight (human, no production changes)

| Step | Action | Verify |
|------|--------|--------|
| 0.1 | Confirm production Git SHA / Vercel lineage (doc 18) | Known baseline |
| 0.2 | Create or select **non-production** Supabase for Preview | Ref ≠ `umswlpkjiwjohkolsyct` for mutation tests |
| 0.3 | Start local Supabase (`supabase start`) OR use staging project | Migrations runnable |
| 0.4 | Rotate any exposed Vercel token (doc 19) | Human confirmation |

---

## Phase 1 — Local / staging DB (expand)

Apply migrations **in order** on Preview/staging DB only:

| Order | Migration | Purpose |
|-------|-----------|---------|
| 1 | `20260906120000_research_projects_rls.sql` | Research tables + program RLS |
| 2 | `20260906140000_lock_app_data_store_rls.sql` | Lock legacy `app_data_store` (requires service-role app writers) |
| 3 | `20260907090000_org_app_data_store_p0_03.sql` | Org-partitioned JSON store + RLS |

**Gate:** `org-app-data-store.p0-03.test.ts` and `research/rls.test.ts` **PASS**.

---

## Phase 2 — Preview application deploy

Deploy apps to Vercel Preview with **staging** env vars (doc 40). Order within Preview:

| Order | Deployable | Depends on | Smoke |
|-------|------------|------------|-------|
| 2.1 | `inspect-mn` (portal) | DB 1–3 on staging | Login, mint embed |
| 2.2 | `inspection-center` | Portal embed secret + DB 2–3 | Scoped IC read/write |
| 2.3 | `bgs-policy-compliance` | Portal embed + DB 2–3 | Scoped policy read/write |
| 2.4 | `development` | DB 1 + portal session | Projects + program CRUD |

**Parallel OK:** 2.2–2.4 after 2.1 env/secrets stable.

**Preview gates (all required):**

- [ ] Embed signed scope required for IC/policy mutations (IC-D05)
- [ ] Unscoped mega-key tenant writes refused (P0-03)
- [ ] Org A embed cannot hydrate Org B IC/policy partition
- [ ] Research program persists across reload; cross-org denied
- [ ] Production build (`next build`) per app
- [ ] No service role in client bundles

**Do not promote** if Preview uses production Supabase URL.

---

## Phase 3 — Preview data migration (optional backfill)

If production mega-rows must be copied to org partitions **on staging only**:

| Step | Action |
|------|--------|
| 3.1 | Export per-org slices from legacy keys (service role, scripted) |
| 3.2 | Upsert into `org_app_data_store(organization_id, key, payload)` |
| 3.3 | Verify IC/policy apps read org rows when embed scope present |

Skip on production until Preview backfill validated.

---

## Phase 4 — Production promotion (explicit human approval only)

**Stop:** Do not execute without written approval.

| Order | Action | Rollback |
|-------|--------|----------|
| 4.1 | Apply migration 1 (`research_*`) on production | New down migration if needed |
| 4.2 | Deploy apps with P0-01 service-role writers + embed secrets | Revert app deploy |
| 4.3 | Apply migration 2 (`lock_app_data_store_rls`) | Policy restore migration |
| 4.4 | Apply migration 3 (`org_app_data_store`) | Leave table; revert app to legacy read if emergency |
| 4.5 | Deploy P0-03 app changes (IC/policy org partition) | Revert app; legacy fallback reads remain |
| 4.6 | Production backfill mega-row → org partitions (if needed) | Restore from backup |
| 4.7 | Smoke on `bteg.inspect.mn` + module URLs | Revert 4.5–4.6 |

**Production env:** Same var **names** as Preview; values point at `umswlpkjiwjohkolsyct`.

---

## Rollback summary

| Failure point | Rollback |
|---------------|----------|
| Preview app regression | Redeploy previous Preview SHA |
| Migration 2 breaks anon writers | Down migration restoring `app_data_store` policies |
| P0-03 app issue | Revert app; `org_app_data_store` can remain empty |
| Production smoke fail | Halt 4.6–4.7; revert app deploy before data backfill |

---

## Track separation (do not combine)

| Track | Contents | This rollout phase |
|-------|----------|-------------------|
| A | IC-D01/D05, unscoped bypass | Preview 2.2 |
| B | RLS lock migration | Phase 1 step 2 / Production 4.3 |
| C | Embed secrets | Preview env / Production 4.2 |
| D | P0-03 org partition | Phase 1 step 3 / Preview 2.2–2.3 / Production 4.4–4.5 |
| E | Program initiatives server | Phase 1 step 1 / Preview 2.4 / Production 4.1 |

---

## Current state

| Item | Status |
|------|--------|
| Remote migrations | **Not applied** |
| Preview deploy | **Not performed** |
| Production deploy | **Not performed** |
| Local P0-03 verification | **PENDING** (doc 39) |

**Agent confirmation:** No production deploy, migration, env change, push, or merge performed while authoring this doc.
