# 24 — Integration and release order

## Proposed integration branch (later, human-created)
`release/prod-stabilization-preview-1`  
**Base:** confirmed Production Git SHA (likely `origin/master` lineage — verify in Vercel first).  
**Do not** merge directly to master from agents.

## Proposed order

| Step | Content | Prerequisite | Risk | Verification | Rollback | Old+new apps |
|------|---------|--------------|------|--------------|----------|--------------|
| 1 | App security: IC-D01/D05, unscoped bypass removed, RD-D01/D02 | Lineage check | Medium (write deny without embed) | Unit + build + HTTP E2E | Revert app commits | Yes (schema unchanged) |
| 2 | Additive DB (none required for step 1) | — | — | — | — | — |
| 3 | Server config: embed secrets (123c17f) | Secrets in Preview env (human) | Embed fail if missing | Portal mint + module verify smoke | Revert commit / restore previous secret via env | Yes if both use same secret |
| 4 | RLS restriction (3b90932) | Step 1+3 apps use service role only | High if anon still used | Local/isolated migrate + store read/write | New down migration restoring policies | **No** — old anon writers break |
| 5 | runtime-info (6c4cb48) | Optional | Low | GET returns masked JSON only | Revert route | Yes |
| 6 | Preview E2E | Steps 1–5 as planned | — | Full gate | — | — |
| 7 | Cleanup | After Preview verified | Low | — | — | — |

## Not in first Preview cut unless explicitly approved
- P0-03 org isolation redesign
- Playwright portal full suite (still a gate blocker for READY)
- Human Vercel token rotation confirmation
