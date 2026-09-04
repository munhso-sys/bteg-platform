# Acceptance checklist — Inspection / Compliance / R&D

Use on Preview (not production apply) after fixes.

## Shared (portal embed)

- [ ] Logged-in admin opens `/inspection`, `/policy-compliance`, `/development` iframes
- [ ] `/api/runtime-info` shows embed secrets + service role present (booleans only)
- [ ] Missing `POLICY_EMBED_SECRET` → policy/inspection embeds fail closed (no soft trust)

## Inspection Center

- [ ] Create run → appears in `/runs` → open detail
- [ ] Score answers → persist after reload
- [ ] Create finding+action from answer → listed under findings/actions
- [ ] Action status transition open→resolved → filtered lists update
- [ ] Unit-scoped embed cannot open `/runs/new` or settings
- [ ] **Negative:** `?scope=unit&heltes_id=...` **without** portal embed is rejected (IC-D01)
- [ ] **Negative:** remote save failure returns error to UI (not silent success)
- [ ] Unauthorized role cannot POST findings
- [ ] Double-click create finding does not duplicate unchecked

## Compliance

- [ ] Create policy → add section/clause → assign responsibility → evaluate
- [ ] Reload persists all of the above on remote store
- [ ] Official code on new position copies links; existing position links unchanged when code set
- [ ] Position-scoped embed cannot edit other positions’ links
- [ ] **Negative:** invalid clause id → 4xx, no UI success toast
- [ ] **Negative:** forced remote write failure → API error, UI shows failure
- [ ] Unlink responsibility → disappears after reload

## Research & Development

- [ ] Documented behavior matches product intent (prototype vs production)
- [ ] If still localStorage: UI banner “зөвхөн энэ төхөөрөмж”
- [ ] If server-backed: create project → second browser same user sees it
- [ ] **Negative:** User B after User A on same browser does not see A’s projects
- [ ] Module not reachable meaningfully without portal session (if auth added)

## Persistence / session

- [ ] Full lifecycle survives hard reload
- [ ] Portal logout → re-login → embed reissued → data still correct
- [ ] Preview deploy → no silent empty store (service role + keys present)
