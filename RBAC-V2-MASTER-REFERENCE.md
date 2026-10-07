# RBAC-V2 MASTER REFERENCE

**Status:** Active single reference for RBAC v2 + navigation enforcement  
**Last updated:** 2026-10-07  
**Branch:** `canonical/assembly`

This document consolidates completed RBAC v2, organizational-scope, and navigation-enforcement architecture plus local implementation status. Superseded intermediate review/report files were folded into this master and removed from the active tree.

---

## 1. Purpose

Provide one maintainable baseline for future development covering:

- Canonical RBAC architecture (A2.6 / A2.6R1 / A2.6R2)
- Navigation allowlist plane (INTERIM_COMPAT)
- E1 schema package relationship (orthogonal to nav storage)
- Local verification (L1 / Wave N1)
- Remaining backlog (N2–N5, remote staging)

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
| Menu IDs | Route hrefs — **V1_LOCKED / TARGET_DEFERRED** |
| Future registry | Permission → surface registry — **DEFERRED** (no locked table name) |
| **NAV-X1** | Missing module config → unrestricted **until NAV-G1**; then fail-closed |
| **NAV-X2** | Per-module signing secrets recommended before permanent cutover |
| **NAV-X3** | Test `admin` / `portal.admin` nav bypass = transitional; target = **OD-10** |
| Soft remint | Preserve menus/submenus; invalid prior cookie → fail closed / re-embed |
| Policy surfaces | `/policies` = Удирдлага; `/policies/review` = Шалгах (same for positions) |

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
- Local E1 rehearsal (L1) = PASS; remote non-prod G1 staging = PENDING (no usable remote staging at execution time)

Draft SQL artifacts retained in repo (operational): `rbac_v2_e1_forward_DRAFT.sql`, `rbac_v2_e1_rollback_DRAFT.sql`, `rbac_v2_e1_validation_DRAFT.sql`.

---

## 5. Production Evidence / Known Risks

(Summary only — no secrets)

| Item | Note |
|------|------|
| Production identity | Referenced historically as Supabase project `umswlpkjiwjohkolsyct` — **must not** be active for local/dev |
| Legacy state | Legacy roles/permissions present; v2 target tables were absent at early audits |
| Process public API | P0 security track (SEC-HF-01) — Process auth hardening tracked separately |
| `app_data_store` RLS | Sensitive shared store — inventory/access-path discipline required |
| Fail-open risks | Missing nav config (pre-NAV-G1); shared embed secret blast radius; Soft/Secure cookie on plain HTTP localhost |

---

## 6. Migration / Implementation Gates

| Gate | Result |
|------|--------|
| G0 physical schema review | PASS |
| G1 DDL package (DBA) | PASS (package) |
| Remote non-prod G1 staging | **PENDING** — usable remote staging unavailable |
| L0 localhost validation | PASS (app) |
| L1 local env isolation + E1 rehearsal | PASS |
| Local PASS ≠ remote DB staging PASS | **Yes — explicit** |

---

## 7. Navigation Implementation Completed (local)

### Portal
- Explicit menu config + unmapped protected path → **DENY**
- Null-safe `menuIds` / `submenuIds` normalization
- Role эрх catalog + `role_menu_visibility` API/UI
- Layout asserts (settings, risk, voice, guidance) + duty module portal assert
- Signed `nav` grant mint for Process/Development embeds

### Policy
- Middleware menu/submenu path enforcement
- Soft remint preserves menus; invalid prior cookie → fail closed / re-embed
- Management vs review independence; org/workplace deep-link mapping
- UI gates (org explorer, workplace links, subnav)

### Inspection
- Middleware menu enforcement + nav context filtering
- No-edit permission → embed mode **view**, not **full**

### Process / Development
- Invalid/expired `nav` → fail closed / `?nav_reembed=1`
- Enforce cookie: invalid session cannot downgrade to unrestricted
- Genuine never-enforced / no-grant → pre-NAV-G1 unrestricted
- Sidebar filtering + `nav` query propagation

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

**`NAV-G1 = NOT READY`** (expected — not an N1 failure).

Before global missing-config fail-closed:

- Catalog versions per module
- Explicit configs for all supported modules
- Route/alias completeness (incl. Reports parity)
- Explicit admin bypass semantics (OD-10 aligned)
- Telemetry + per-module secret strategy
- Mandatory evidence table Result=PASS for every module

Until NAV-G1: missing config must **not** globally fail-closed.

---

## 10. Remaining Development Backlog

| Wave | Focus |
|------|--------|
| **N2** | Regression automation (authorizeNavigation contract tests) |
| **N3** | Module parity — Reports, Risk, Voice, Guidance; UI capability vs surface clarity |
| **N4** | Token/security — dedicated Process/Development secrets; issuer/audience; cookie/local policy |
| **N5** | NAV-G1 evidence + compatibility exit |
| **DB** | Remote non-production E1 staging (separate track) |

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
| Navigation Wave N1 | PASS |
| NAV-G1 | NOT READY |
| Remote non-prod staging | PENDING |
| Git push | See §13 |
| Production deploy | **NOT AUTHORIZED** |

---

## 13. Git

| Field | Value |
|-------|-------|
| Branch | `canonical/assembly` |
| Commit | _pending_ (filled after commit) |
| Remote | `origin` (`origin/canonical/assembly`) |
| Push | _pending_ |
| Timestamp | 2026-10-07 (local pre-push gate) |
| Final localhost gate | **PASS** — Portal :3000 200; LOCAL Supabase only; prod ref absent; Policy management DENY; Policy review ALLOW; Process/Development invalid nav FAIL-CLOSED; N1 unit tests PASS; typechecks PASS |

---

*End of RBAC-V2-MASTER-REFERENCE*
