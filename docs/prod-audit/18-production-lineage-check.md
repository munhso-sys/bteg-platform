# 18 — Production lineage check

**When:** 2026-09-05 (local)  
**Production actions:** none

## Snapshot

| Item | Value |
|------|--------|
| Current branch | `fix/prod-stabilization-p0` |
| Current HEAD | `c723773` |
| Local `master` | `597d1ff` |
| `origin/master` | `597d1ff` |
| `main` branch | **Does not exist** |
| `origin/master` ancestor of HEAD? | **Yes** (`merge-base --is-ancestor` exit 0) |

## Production branch assumption

- Default remote HEAD is `origin/master` (`remotes/origin/HEAD -> origin/master`).
- No `main` ref in this clone.
- **Do not assume `master` is Production without Vercel confirmation.** Safe read-only Vercel CLI listing was **unavailable** in this environment (CLI not logged / not present). Local `.vercel/project.json` found only under `bgs-policy-compliance` (`platform-policy-compliance`); portal/inspection/development project links were not present in the working tree.

## Divergence: deployed Production vs `c723773`

| Question | Finding |
|----------|---------|
| Exact Production deploy SHA | **Unknown** (no authenticated Vercel metadata in this session) |
| Relationship of `c723773` to `origin/master` | Stabilization branch = `master` + audit docs + IC-D01/D05 commits; **ahead of** `597d1ff`, not based on an unrelated fork |
| Risk if Production tracks `master` | Preview/prod of this branch would introduce IC-D01/D05 (+ later RD fixes) on top of currently shipped `597d1ff` lineage |
| Auto rebase/merge | **Not performed** |

## Conclusion

Stabilization work is on the **master lineage**. Exact live Production commit could not be confirmed read-only here; human should verify Vercel Production Git SHA before any Preview integration branch is cut from “production lineage.”
