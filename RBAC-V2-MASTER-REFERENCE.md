# RBAC-V2 MASTER REFERENCE

**Status:** Active single reference for RBAC v2 + navigation enforcement  
**Last updated:** 2026-10-07  
**Branch:** `canonical/assembly`

This document consolidates completed RBAC v2, organizational-scope, and navigation-enforcement architecture plus local and remote non-prod implementation status. Superseded intermediate review/report files were folded into this master and removed from the active tree.

---

## 1. Purpose

Provide one maintainable baseline for future development covering:

- Canonical RBAC architecture (A2.6 / A2.6R1 / A2.6R2)
- Navigation allowlist plane (INTERIM_COMPAT)
- E1 schema package relationship (orthogonal to nav storage)
- Local verification (L1 / Wave N1)
- Remote non-prod E1 staging closure
- Navigation Waves N2–N5 and NAV-G1 readiness

---

## 2. Final Architecture

```text
USER
→ ORGANIZATION MEMBERSHIP
→ ORGANIZATIONAL UNIT
→ POSITION
→ DEFAULT ROLE ASSIGNMENT POLICY
→ APPLICATION ROLE(S)
→ PERMISSION
→ DATA SCOPE
→ RECORD RELATIONSHIP
→ SERVER-SIDE AUTHORIZATION
```

**Locked invariants**

| Rule | Meaning |
|------|---------|
| Position ≠ permission | Position is context/provisioning only |
| Role = reusable permission bundle | Not a job title |
| Scope ≠ capability | Scope types do not encode actions |
| `assigned` ≠ `department` | Distinct scope semantics |
| No `scope_type=none` | Use `scope_mode` instead |
| `scope_mode` | `required` \| `not_applicable` |
| DENY precedence | Matching scoped DENY beats ALLOW |
| Default deny | No matching allow → deny |
| No ABAC DSL | No policy scripting / inheritance graph |
| Server authorize authoritative | Permission checks are backend-authoritative |
| Frontend permission payload | UX guidance only (never data/action authority) |

---

## 3. Navigation Architecture

**Classification:** `INTERIM_COMPAT` (Option B / AD-22) — not a permanent second permission taxonomy.

Navigation = route/surface **reachability**.  
Permission = data/actions.

```text
Navigation DENY
→ route/surface denied

Navigation ALLOW
→ does not grant permission

Permission DENY
→ cannot be bypassed by navigation ALLOW

Protected interactive data/action surface
→ NAV PASS AND PERMISSION PASS
```

| Topic | Decision |
|-------|----------|
| Storage | `app_data_store.role_menu_visibility` — **INTERIM_COMPAT** (not in E1 DDL) |
| Menu IDs | Route hrefs — **V1_LOCKED / TARGET_DEFERRED** (`NAV_MENU_CATALOG_VERSION = "v1"`) |
| Future registry | Permission → surface registry — **DEFERRED** |
| **NAV-X1** | Missing module config → unrestricted **until** `NAV_G1_ENFORCE=1`; then fail-closed |
| **NAV-X2** | Per-module signing: `PROCESS_NAV_SECRET` / `DEVELOPMENT_NAV_SECRET` (fallback embed secrets during rollout) |
| **NAV-X3** | Test `admin` / `portal.admin` nav bypass = transitional; target = **OD-10**; bypass skips menu allowlist only — **not** permission/data auth |
| Soft remint | Preserve menus/submenus; invalid prior cookie → fail closed / re-embed |
| Policy surfaces | `/policies` = Удирдлага; `/policies/review` = Шалгах (same for positions) |
| Contract | Shared `authorizeNavigation` + `nav-telemetry` (`nav.allow` / `nav.deny` / `nav.config_missing` / `nav.token_*` / `nav.route_unmapped` / `nav.compat_allow`) |

UI filtering = defense-in-depth. Middleware / server layouts = route enforcement.

---

## 4. Approved Target RBAC Schema

Target v2 physical tables (E1+):

- `organizations`
- `organizational_units` / `organizational_unit_aliases`
- `positions` / `position_aliases`
- `user_org_memberships` / `user_positions`
- `rbac_roles` / `rbac_role_permissions` / `user_roles`
- `user_permission_overrides` / `temporary_grants`

**E1 relationship**

- Approved E1 DDL package remains unchanged by navigation work
- Navigation interim storage is **orthogonal** — no nav DDL added to E1
- Local E1 rehearsal (L1) = PASS
- Remote non-prod E1 staging = **PASS** (see §14)

Draft SQL artifacts retained in repo: `rbac_v2_e1_forward_DRAFT.sql`, `rbac_v2_e1_rollback_DRAFT.sql`, `rbac_v2_e1_validation_DRAFT.sql`.

---

## 5. Production Evidence / Known Risks

(Summary only — no secrets)

| Item | Note |
|------|------|
| Production identity | Supabase project `umswlpkjiwjohkolsyct` (`inspect-bteg`) — **must not** be active for local/dev staging SQL |
| Legacy state | Legacy roles/permissions present; v2 tables applied only on non-prod staging after E1 rehearsal |
| Process public API | P0 security track (SEC-HF-01) — Process auth hardening tracked separately |
| `app_data_store` RLS | Sensitive shared store — inventory/access-path discipline required |
| Staging note | Branch project also has `public._preview_seed_chunks` with RLS disabled (pre-existing; not E1-owned) — remediate separately |
| Fail-open risks | Missing nav config only when `NAV_G1_ENFORCE` is off; shared embed secret fallback during secret rollout |

---

## 6. Migration / Implementation Gates

| Gate | Result |
|------|--------|
| G0 physical schema review | PASS |
| G1 DDL package (DBA) | PASS (package) |
| Remote non-prod G1 staging | **PASS** — see §14 |
| L0 localhost validation | PASS (app) |
| L1 local env isolation + E1 rehearsal | PASS |
| Local PASS ≠ remote DB staging PASS | Historical note; remote staging now closed |

---

## 7. Navigation Implementation Completed

### Portal
- Explicit menu config + unmapped protected path → **DENY**
- Null-safe `menuIds` / `submenuIds` normalization
- Role эрх catalog + `role_menu_visibility` API/UI (`catalogVersion: v1`)
- Layout asserts (settings, risk, voice, guidance, **report-analysis**) + duty module portal assert
- Signed `nav` grant mint prefers module secrets; grants carry `catalogVersion`
- Shared `authorizeNavigation` + telemetry

### Policy
- Middleware menu/submenu path enforcement via shared contract
- Soft remint preserves menus; invalid prior cookie → fail closed / re-embed
- Management vs review independence; org/workplace deep-link mapping
- `NAV_G1_ENFORCE=1` → missing config fail-closed

### Inspection
- Middleware menu enforcement + nav context filtering
- No-edit permission → embed mode **view**, not **full**
- G1 missing-config fail-closed

### Process / Development
- Invalid/expired `nav` → fail closed / `?nav_reembed=1`
- Enforce cookie: invalid session cannot downgrade to unrestricted
- Valid grants signed with `PROCESS_NAV_SECRET` / `DEVELOPMENT_NAV_SECRET` verified in N2 tests
- Genuine never-enforced / no-grant → pre-NAV-G1 unrestricted **only when** `NAV_G1_ENFORCE` off

### Reports / Risk / Voice / Guidance
- Explicit catalog entries + route resolvers
- Server layout asserts (Reports via `report-analysis/layout.tsx`)
- Nested route coverage in N2 automation

---

## 8. Local Verification Results (Wave N1 final)

| Check | Result |
|-------|--------|
| Portal `:3000` | PASS |
| Policy `:3002` | PASS |
| Development `:3003` | PASS |
| Process `:3004` | PASS |
| LOCAL Supabase only | PASS |
| Production ref absent | PASS |
| Authenticated shell | PASS |
| Policy management direct/org/workplace | DENY → `/dashboard` |
| Policy `/policies/review` | ALLOW (200) |
| Process / Development invalid nav | FAIL-CLOSED (307 + re-embed) |
| Genuine no-config / no-grant | Pre-NAV-G1 compat ALLOW |
| Production writes | None |

---

## 9. NAV-G1 Current State

**`NAV-G1 = READY`** (non-production / local evidence complete).

Fail-closed cutover mechanisim: set `NAV_G1_ENFORCE=1` in local/non-prod environments. Default in committed code remains **off** until operators enable it per environment. Automated fixtures prove fail-closed when the flag is on. Production cutover remains **NOT AUTHORIZED**.

---

## 10. Remaining Development Backlog

| Item | Status |
|------|--------|
| Wave N2 regression automation | **PASS** |
| Wave N3 module parity | **PASS** |
| Wave N4 token/security | **PASS** (non-prod secret wiring + tests) |
| Wave N5 telemetry + exit prep | **PASS** |
| Remote non-prod E1 staging | **PASS** |
| Production E1 apply | **NOT AUTHORIZED** |
| Production NAV-G1 cutover (`NAV_G1_ENFORCE=1` in prod) | **NOT AUTHORIZED** |
| Permanent OD-10 admin mapping | Deferred (transitional bypass documented) |

---

## 11. Hard Release Rules

### Before every future git push
`localhost:3000` validation required — typecheck/tests for change, localhost smoke, LOCAL/non-prod backend, no accidental production ref.

### For DB/schema work
Localhost validation does **not** replace non-production DB staging/migration validation.

### Before production deploy
Requires **explicit separate owner authorization**. This document does not authorize production deploy.

---

## 12. Current Final Status

| Track | Status |
|-------|--------|
| RBAC architecture | APPROVED |
| Navigation architecture | APPROVED |
| E1 DDL package | APPROVED |
| Local E1 rehearsal | PASS |
| **Remote non-prod E1 staging** | **PASS** |
| Navigation Wave N1 | PASS |
| N2 regression | PASS |
| N3 parity | PASS |
| N4 security | PASS |
| N5 exit prep | PASS |
| **NAV-G1** | **READY** |
| Preview/non-prod regression | PASS (local multi-app non-prod cluster + staging DB) |
| Git push | **PASS** — `4f3a7c1` (see §13) |
| Production E1 apply | **PASS** |
| Production app deploy | **PASS** |
| Production smoke (unauth) | **PASS** |
| Production authenticated smoke / negatives | **BLOCKED** — needs operator credentials |
| Production `NAV_G1_ENFORCE` | **OFF** (cutover deferred) |
| Production deploy gate | **PROD-CONDITIONAL** (see §17) |

---

## 13. Git

| Field | Value |
|-------|-------|
| Branch | `canonical/assembly` |
| Prior curated commit | `574cf04746aa8dbd7095c0a042c7cd5adc3942c2` |
| Remote | `origin` → `https://github.com/munhso-sys/bteg-platform.git` |
| Gate closure commit | `4f3a7c1fe6c15178a0cc25889110fd82adce9a47` — `feat(rbac): close remote E1 staging and NAV-G1 readiness` |
| Push result | **PASS** — `588caca..4f3a7c1  HEAD -> canonical/assembly` (no force) |
| Push timestamp | 2026-10-07 22:10 (UTC+8) |
| Timestamp | 2026-10-07 |
| Final localhost gate | **PASS** — Portal :3000 UP; LOCAL Supabase; prod ref absent; N1+N2 tests PASS; typechecks PASS; Process/Dev invalid nav FAIL-CLOSED |

---

## 14. Remote Staging Closure

### Environment identity

| Field | Value |
|-------|--------|
| Purpose | Non-production E1 DDL rehearsal for inspect.mn |
| Parent production project | `inspect-bteg` / ref `umswlpkjiwjohkolsyct` — **never written by this rehearsal** |
| Staging branch name | `fix-prod-stabilization-p0` |
| Staging project ref | `epismclrjnpgewpaiidd` |
| Proof non-production | `STAGING_REF != PRODUCTION_REF` (`epismclrjnpgewpaiidd` ≠ `umswlpkjiwjohkolsyct`); branch `is_default=false`; `with_data=false` |
| Region / status | Active healthy preview branch of inspect-bteg |
| Rejected alternatives | Production ref forbidden; `bmce-dispatch` (`kzexcmnybyckgigkewxq`) rejected as unrelated product |

### Baseline (pre-E1)

- Legacy present: `roles`, `permissions`, `role_permissions`, `user_profiles`, `access_requests`, `temporary_edit_grants`, `app_data_store`
- `pgcrypto` / `gen_random_uuid()` available
- No v2 target tables (`organizations`, …) before forward
- Preflight Section A (A3, A6, A8–A13) = **PASS**
- Drift note: pre-existing `_preview_seed_chunks` RLS disabled (not E1-owned)

### Execution sequence (approved package)

| Step | Result |
|------|--------|
| Identity gate | PASS |
| Baseline snapshot | PASS |
| Preflight A | PASS |
| Forward E1 | PASS |
| Postflight B1–B8 | PASS |
| C/D negative+positive + residue | PASS |
| Rollback rehearsal | PASS |
| F1–F7 post-rollback | PASS |
| Clean reapply | PASS |
| Final post-reapply validation | PASS |

### Final gate

**`STAGING-PASS` — REMOTE NON-PROD E1 STAGING PASSED**

Staging left with E1 schema reapplied (empty v2 tables; legacy intact). No production SQL.

---

## 15. NAV-G1 Closure

### Module evidence table

| Module | Catalog version | Explicit config | Route mapping / aliases | Admin/system bypass defined | Server enforcement | Automated regression | Result |
|--------|-----------------|-----------------|-------------------------|-----------------------------|--------------------|----------------------|--------|
| Portal | v1 | Yes (`portal` + settings) | Top-level resolver + unmapped deny | `admin` / `portal.admin` (menu only; OD-10 transitional) | Layout asserts | N1+N2 | **PASS** |
| Policy | v1 | Embed menus/submenus | Management vs review; org/workplace | No nav bypass; permission separate | Middleware | N1+N2 | **PASS** |
| Inspection | v1 | Embed menus | Inspection resolver | Permission write-mode separate | Middleware | N2 + write-access | **PASS** |
| Process | v1 | Signed nav grant | Process path resolver | None in middleware | Middleware + enforce cookie | N1+N2 valid/invalid | **PASS** |
| Development | v1 | Signed nav grant | Development path resolver | None in middleware | Middleware + enforce cookie | N1+N2 valid/invalid | **PASS** |
| Risk | v1 | `risk-management` catalog | Nested resolver | Via portal assert bypass rules | Layout assert | N2 | **PASS** |
| Voice | v1 | `employee-voice` catalog | Nested resolver | Via portal assert bypass rules | Layout assert | N2 | **PASS** |
| Guidance | v1 | `guidance` catalog | Nested resolver | Via portal assert bypass rules | Layout assert | N2 | **PASS** |
| Reports | v1 | `report-analysis` + 7 children | `resolveReportMenuPath` | Via portal assert bypass rules | `report-analysis/layout.tsx` | N2 | **PASS** |

### Regression summary

- N1 scripts: portal / policy / process / development — PASS
- N2 scripts: portal (47), policy (16), process (12), development (9), inspection (11) — PASS
- Typecheck: five apps — PASS
- Localhost :3000–:3004 UP; invalid Process/Development nav → 307 re-embed
- Production Supabase ref absent from active local portal env

### Secret / token status (non-prod)

- Prefer `PROCESS_NAV_SECRET` / `DEVELOPMENT_NAV_SECRET` for sign+verify
- Fallback to embed secrets during rollout (documented)
- Cookie guidance: HttpOnly; Secure not weakened for production; localhost environment-aware comments only
- No secret values recorded in this document

### Telemetry status

- Events: `nav.allow`, `nav.deny`, `nav.config_missing`, `nav.token_invalid`, `nav.token_expired`, `nav.route_unmapped`, `nav.compat_allow`
- Metadata allowlist only (module, surface/path stripped of query, reason, catalog version, g1 flag)
- Tokens/secrets never logged

### Fail-closed non-prod validation

- `NAV_G1_ENFORCE=1` → missing config / missing grant DENY (`config_missing`) — proven in automated fixtures
- Default committed behavior remains flag-off (compat) until environment enables the flag
- Production `NAV_G1_ENFORCE` cutover **deferred** pending authenticated production smoke (see §17)

### Final gate

**`NAV-G1 = READY`** (architecture/evidence). Production enforce flag remains **OFF** until §17 authenticated gate closes.

---

## 16. Release execution gate (pre-production)

## RELEASE-GATES-READY

`REMOTE STAGING PASS + NAV-G1 READY — READY FOR OWNER PRODUCTION DEPLOY DECISION`

Owner subsequently authorized production deployment (2026-10-07). See §17.

---

## 17. Production Deployment

**Timestamp:** 2026-10-07 (UTC+8 evening)  
**Production project:** `inspect-bteg` / ref `umswlpkjiwjohkolsyct` (confirmed)  
**Release implementation commit:** `4f3a7c1fe6c15178a0cc25889110fd82adce9a47`  
**Deployed tip (includes docs-only follow-up):** `2dc91eece072b4700cd7d3494df32917d45c0ac6`

### Rollback evidence (pre-E1)

| Item | Evidence |
|------|----------|
| DB restore marker | `public._e1_prod_rollback_marker` id `pre_e1_2026_10_07` + `_e1_prod_baseline` counts |
| Approved E1 rollback SQL | `rbac_v2_e1_rollback_DRAFT.sql` (use only if DB proven causal) |
| App rollback targets | Prior Ready: portal `platform-portal-8bnx7y9hm`, IC `…-lwcw8gycm`, policy `…-7cwtziv3n`, process `…-mob250pao`, development `…-n3r7delll` |
| `NAV_G1_ENFORCE` pre-state | Absent / OFF on all five Vercel production projects |

### E1 apply result

| Step | Result |
|------|--------|
| Identity gate | PASS (`inspect-bteg` / `umswlpkjiwjohkolsyct`) |
| Preflight Section A | PASS |
| Forward apply | PASS (`rbac_v2_e1_forward_production`) |
| B1–B8 | PASS |
| C/D + residue | PASS |
| Seed role mappings | **Not performed** (not authorized) |
| Post-deploy health | 12/12 E1 tables present; permissions 22/22 `legacy`; `rbac_v2_ready=true` count 0; E1 tables empty |

### Application deploy result

| App | Production | Result |
|-----|------------|--------|
| Portal | `https://bteg.inspect.mn` | READY |
| Inspection | `https://platform-inspection-center.vercel.app` | READY |
| Policy | `https://platform-policy-compliance.vercel.app` | READY |
| Process | `https://platform-process.vercel.app` | READY |
| Development | `https://platform-development-amber.vercel.app` | READY |

### Navigation secrets (presence only — no values)

| Secret | Portal | Policy | Inspection | Process | Development |
|--------|:------:|:------:|:----------:|:-------:|:-----------:|
| `POLICY_EMBED_SECRET` | yes | yes | — | — | — |
| `INSPECTION_EMBED_SECRET` | yes | — | yes | — | — |
| `PROCESS_NAV_SECRET` | yes | — | — | yes | — |
| `DEVELOPMENT_NAV_SECRET` | yes | — | — | — | yes |
| `NAV_G1_ENFORCE` | **absent (OFF)** | OFF | OFF | OFF | OFF |

Dedicated Process/Development nav secrets were provisioned to production during this deploy (values not recorded).

### Smoke result (`NAV_G1_ENFORCE` OFF)

| Check | Result |
|-------|--------|
| Portal `/api/supabase/health` + `/api/runtime-info` | PASS (`ok`, service role + embed flags true, production env) |
| Five origins HTTP (no 5xx) | PASS |
| Portal login page | PASS |
| Process/Development invalid `nav` → `nav_reembed=1` | PASS |
| Authenticated login / Role эрх / module matrix | **BLOCKED_NEED_CREDENTIALS** |
| Controlled negative Policy/org/workplace tests | **NOT RUN** (credentials) |
| Permission-deny-with-nav-allow | **NOT RUN** (credentials) |
| Telemetry production event verification | **NOT RUN** (needs auth traffic + log access) |

### `NAV_G1_ENFORCE` state

**OFF** — production cutover **not performed**. Owner rule: enable only after full production smoke PASS. Authenticated smoke incomplete → STOP before cutover.

### Rollback status

**Not required.** No P0 regression observed on unauthenticated paths; apps left on new Ready deployments with G1 off (pre-G1 compat). E1 left applied (additive; validated).

### Remaining operator actions before PROD-PASS

1. Authenticated production smoke with controlled test role/account  
2. Section 9 negatives (Policy management/review, deep links, invalid grants, permission independence)  
3. Set `NAV_G1_ENFORCE=1` on all five production projects  
4. Re-smoke + confirm no unexpected `nav.compat_allow` for supported modules  
5. Update this section with final PROD-PASS

### Final production gate

## PROD-CONDITIONAL

`PRODUCTION DEPLOYED — MINOR NON-BLOCKING ISSUES REMAIN`

(E1 + apps live; `NAV_G1_ENFORCE` deferred pending authenticated validation.)

---

*End of RBAC-V2-MASTER-REFERENCE*
