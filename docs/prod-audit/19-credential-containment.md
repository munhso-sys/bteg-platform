# 19 — Credential containment

**When:** 2026-09-05  
**Path:** `bgs-policy-compliance/vercel token.txt`  
**No file contents, hashes, or token values are recorded here.**

## Metadata checks

| Check | Result |
|-------|--------|
| Working tree present (before) | Yes (untracked `??`) |
| Tracked by Git (`git ls-files`) | **No** |
| Ignored before change | **No** |
| Path in local commit history | **No matches** (`git log --all` for this path empty) |
| Similarly named files | Only this path under repo (excluding node_modules) |
| Secret scanner config (gitleaks/trufflehog/pre-commit) | **None found** in repo |
| Staged | **No** (never staged) |

## Actions taken

1. Added ignore rules in root `.gitignore` and `bgs-policy-compliance/.gitignore` for the exact unsafe path pattern.
2. Confirmed file not staged.
3. Deleted the plaintext file from the working tree via filesystem delete (**contents not read/printed/copied**).
4. Did not stash, document, or relocate the secret material.
5. Did not use the file for authentication.

## Human required

- **Revoke and rotate** any Vercel token that may have been stored in that file.
- Confirm Vercel dashboard tokens and CI secrets after rotation.
- History rewrite **not required** for this path (never committed). If other secrets are later found in history, remediate separately — do not auto-rewrite shared history.

## Preview readiness impact

- Path **not** in Git history → not an automatic history-exposure FAIL by itself.
- Local presence of plaintext credentials is still a process FAIL until human rotates the token.
- Gate docs treat **human token rotation** as a Preview blocker until confirmed.
