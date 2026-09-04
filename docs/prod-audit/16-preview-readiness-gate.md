# 16 — Preview readiness gate

## Decision: **NOT READY**

### Why not READY
1. Full required E2E list (portal login, cross-org, create/update persistence, failed-mutation UX) is **incomplete** — only IC-D01/D05 HTTP security probes exist.
2. Batch 1 **P0-01** (restrictive RLS) and **P0-02** (embed secret fail-closed) are **intentionally excluded** from this branch; production Preview of “full stabilization” would be incomplete without a separate plan.
3. No human Preview deployment requested or performed (and must not be auto-created).
4. `master` still embeds hardcoded anon fallback in inspection server client (unchanged here); Preview of this branch alone does not fix P0-01.

### What is ready for human review (local PR-ready)
- Application-only IC-D01 + IC-D05 fixes with passing unit + `next build` + `next start` HTTP tests.
- Documentation inventory, dependency map, evidence, release order.

### Gate to flip READY → (human)
- [ ] Preview deploy of this branch to **non-production** DB (or remote-disabled)
- [ ] Portal signed embed smoke (full + unit)
- [ ] Soft-query negative smoke
- [ ] Unauthenticated mutation negative smoke
- [ ] Confirm `INSPECTION_ALLOW_UNSCOPED_WRITES` unset on Preview
- [ ] Optional follow-up tracks for P0-01/P0-02 scheduled separately
