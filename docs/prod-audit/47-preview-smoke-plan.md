# 47 — Preview smoke test plan

Run **after** isolated Preview deploy (human-triggered). Against Preview URLs only.

| # | Check | PASS | FAIL |
|---|-------|------|------|
| 1 | `GET /api/runtime-info` | `ok`, masked ref ≠ prod, no JWT/key material | secrets, wrong project, 5xx |
| 2 | Auth | login/logout/reload; bad password stays on login | session stuck, open redirect |
| 3 | Portal/embed | valid signed embed works; missing/forged/expired/unsigned denied | soft-mint, scope cookie from query |
| 4 | IC | IC-D01/D05 HTTP probes; unscoped write denied | cookie mint / write without embed |
| 5 | Research | create/list/edit project persists across reload | empty after reload; localStorage-only |
| 6 | Program | create/edit initiative via API/UI persists | localStorage authoritative |
| 7 | Cross-org | B cannot list/update A; forged org insert 403 | any A row visible to B |
| 8 | Persistence | second browser context sees permitted data | data lost on new session |
| 9 | Secret scan | client bundles: no service-role / embed secret values | key material in static JS |
| 10 | Vercel logs | no stack dumps of secrets; expected auth denials only | leaked env |
| 11 | OpenClaw | independent QA sign-off | blocker filed |

**Suite stop rule:** any FAIL in 1–8 blocks promotion; 9–11 required before Production consideration.
