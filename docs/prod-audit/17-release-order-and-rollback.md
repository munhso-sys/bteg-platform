# 17 — Release order and rollback

## Tracks (do not combine into one inseparable deploy)

### A — Application compatibility (THIS BRANCH)
**Contents:** IC-D01 soft-mint removal; IC-D05 fail-closed write/admin gates; regression tests; audit docs 11–17.  
**Migration required:** No.  
**Env required for Preview/Prod:** Existing embed secrets as already used by portal; do **not** set `INSPECTION_ALLOW_UNSCOPED_WRITES`.  
**Backward compatible:** Yes with currently deployed schema. Standalone local editing without embed needs explicit escape env.  
**Rollback:** Revert application commits on this branch.

### B — Additive/restrictive database (Batch 1 `3b90932` — NOT included here)
**Contents:** `inspect-mn/supabase/migrations/20260904120000_lock_app_data_store_rls.sql`  
**Classification:**
| Statement | Class |
|-----------|--------|
| `ENABLE ROW LEVEL SECURITY` | restrictive / backward compatible for service_role writers |
| `DROP POLICY` open policies | restrictive / **breaks anon writers** |
| `REVOKE` anon/authenticated | restrictive / rollback-sensitive |
| `GRANT` service_role | additive for clarity |

**Rollout rule:** Deploy/verify app writers use service role **before** applying restrictive policies to production. Expand (app) → migrate → contract.  
**Rollback:** Restore prior policies via a new down-migration (do not dashboard-edit).

### C — Server-side configuration (Batch 1 `123c17f` — NOT included here)
**Contents:** Remove hardcoded embed HMAC; require `POLICY_EMBED_SECRET` / `INSPECTION_EMBED_SECRET`.  
**Apps:** portal (`inspect-mn`) + verification in module apps.  
**Missing secret:** embed mint/verify fails independently of RLS; with Track A, writes fail closed.  
**Rollback:** Re-introduce previous signer only via controlled commit (avoid hardcoded secret).

### D — Later contract/cleanup
- Remove `INSPECTION_ALLOW_UNSCOPED_WRITES` escape after local workflows use signed embeds.
- P0-03 org isolation / RPC instead of broad service role.
- IC-D02/D06/D07 and RD-D01/D02.

## Suggested human sequence
1. Merge/review **Track A** Preview (non-prod DB).
2. Set embed secrets on Preview (Track C) if not already.
3. Apply Track B migration only after service-role writers verified on Preview.
4. Production promotion only after smoke checklist — **explicit human instruction required**.

## Env by deployable (Track A reality)

| Deployable | Required for Track A | Notes |
|------------|----------------------|-------|
| inspection-center | Embed verify secrets if testing signed allow paths | Writes deny without scope after IC-D05 |
| inspect-mn | Embed **sign** secrets to mint tokens | Portal auth unchanged by Track A |
| bgs-policy-compliance | Unaffected by Track A | |
| All | Never put service role in `NEXT_PUBLIC_*` | |

## Confirmation
No production deploy, migration, secret change, push, or merge was performed by this agent run.
