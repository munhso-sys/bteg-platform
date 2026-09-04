# 10 — Prioritized Fix Plan (No Implementation Yet)

## Principles

- Small PRs  
- Security before performance cosmetics  
- Prefer tightening RLS and secrets over rewriting architecture  
- Do not migrate all JSON to SQL in the first batch  

## Batch A — Safest first (P0 security) — **START HERE**

| PR | Change | Migration? | Rollback |
|----|--------|------------|----------|
| A1 | Replace `app_data_store` policies: deny `anon`; allow only `service_role` (and/or narrow authenticated server paths). Update module writers to always use service role on Vercel. | Yes (RLS only) | Re-apply previous policies |
| A2 | Remove hardcoded `"inspect-platform-policy-embed-v1"`; require `POLICY_EMBED_SECRET` / `INSPECTION_EMBED_SECRET`; fail closed if missing in production. Rotate secrets. | No | Redeploy prior + old secret temporarily in verify list |
| A3 | Add `/api/runtime-info` masked endpoint + document Vercel env checklist | No | Delete route |

**Tests for Batch A:** RLS anon denied; embed forge fails; runtime-info returns masked ref.

## Batch B — Production parity (P1)

| PR | Change |
|----|--------|
| B1 | Link all four Vercel projects to Git monorepo with correct Root Directory; document deploy matrix |
| B2 | Ensure Preview/Production env names match; prevent SmartMine URL as portal URL |
| B3 | Seed/verify remote store keys exist for inspection + policy; runbook for `data/` → remote |
| B4 | Align Git migrations with remote (apply or record `20260817_add_smartmine_permission`) |

## Batch C — Auth resilience (P1)

| PR | Change |
|----|--------|
| C1 | Middleware: distinguish timeout vs unauthenticated; retry once; metric |
| C2 | Prefer `getUser` over `getSession` on sensitive pages |
| C3 | Revoke anon EXECUTE on SECURITY DEFINER RPCs per advisor |

## Batch D — Data model / performance (P2+)

| PR | Change |
|----|--------|
| D1 | Add `schemaVersion` / etag to store payloads; conditional writes everywhere |
| D2 | Split large store keys by year/unit **or** begin relational extraction for findings/actions (large program — separate design) |
| D3 | Fix RLS initplan + missing FK indexes |
| D4 | Consider Vercel region closer to `ap-southeast-2` |

## Batch E — Quality gates

| PR | Change |
|----|--------|
| E1 | Vitest: RBAC + embed crypto + store schema |
| E2 | Playwright Preview smoke |
| E3 | Structured logging helper |

## Out of scope for early batches

- Broad rewrite to replace iframe architecture  
- Full SQL redesign of policy/inspection without product decision  
- Production data cleanup / seed via destructive commands  

## Wait state

Implement **only after explicit instruction**. Prefer Batch A next.