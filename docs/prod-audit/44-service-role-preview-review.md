# 44 — Service-role Preview review

**Branch:** `fix/prod-stabilization-p0`  
**Date:** 2026-09-07

Classification key:
- **A** — infrastructure/admin-only, justified for Preview
- **B** — ordinary user CRUD; migrate later to user JWT + RLS (not Preview blocker if org-partitioned + fail-closed)
- **C** — unsafe / Preview blocker

## Inventory

| Path | App | Class | Server-only | Org resolved server-side | Fail-closed null org | Shared mega-row |
|------|-----|-------|-------------|--------------------------|----------------------|-----------------|
| IC `store/remote.ts` → `org_app_data_store` | inspection-center | **B** | Yes | Embed `heltesId` | Yes (refuse write) | No (partitioned) |
| IC legacy `app_data_store` read fallback | inspection-center | **A/B** | Yes | N/A read-only | Writes refused | Legacy read only |
| Policy `remote-store` → `org_app_data_store` for `policy_compliance_db` | policy | **B** | Yes | Embed `heltesId` | Yes (throw) | No when scoped |
| Policy override catalog keys (global) | policy | **A** | Yes | Platform catalog | N/A | Global config |
| Portal guidance / voice / AI / telegram stores | portal | **A** (platform) / **B** (voice still mega) | Yes | Partial JS filter for voice | Varies | Voice still mega — **future B→normalize**; not P0-03 tenant JSON path for Preview if unused in smoke |
| Research projects/program APIs | development | *(none)* | User JWT | Profile `heltes_id` + RLS | Yes | N/A |
| Auth admin seed / local test harness | scripts | **A** | CLI only | Synthetic | N/A | N/A |

## Category C

**None identified** for the Preview smoke path after P0-03 org partition + refused unscoped tenant mega writes.

Remaining **B** paths (IC/policy service-role document I/O) are documented for post-Preview migration to user JWT + RLS. They are not classified C because:
- secrets are server-only
- organization comes from signed embed scope, not client-chosen free text
- null org refuses writes
- tenant documents are org-partitioned (`organization_id, key`)

## Preview decision input

No category-C service-role path → does **not** block Preview on this axis alone.
