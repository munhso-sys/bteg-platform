# 20 — Unscoped-write hardening

## Decision
**Removed** the effective bypass. `allowUnscopedInspectionWrites()` always returns `false`.

Legacy env names (`INSPECTION_ALLOW_UNSCOPED_WRITES`, `INSPECTION_DEV_ALLOW_UNSCOPED_WRITES`) are recognized only so tests prove they cannot grant access.

## Runtime guards (defense in depth)
`isHostedOrProductionRuntime()` treats as hosted when:
- `NODE_ENV=production`
- `VERCEL=1`
- `VERCEL_ENV=preview|production`

Even if a future contributor reintroduces a flag, tests lock deny behavior under these conditions. Current code denies null scope unconditionally.

## Behavior matrix

| Context | Null scope write |
|---------|------------------|
| Local next start (production build) | Denied |
| Vercel Preview / Production | Denied |
| Flag set + any hosted env | Denied |
| Flag absent | Denied |
| Valid signed full embed | Allowed per role |
| Unit embed | Denied |

No `NEXT_PUBLIC_*` bypass variable exists.

## Tests
`inspection-center` `npm run test:access` — IC-D05 suite covers flag/production/VERCEL/preview/zero-rows/scope-error cases.
