# Vercel environment checklist (Batch 1)

Apply to **platform-portal**, **platform-inspection-center**, and **platform-policy-compliance** before enabling the `app_data_store` RLS lock migration in production.

## Required (all three apps)

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Must be `inspect-bteg` (`umswΓÇªsyct`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/auth only ΓÇö **not** for `app_data_store` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required** for remote JSON store after Batch 1 |
| `POLICY_EMBED_SECRET` | Strong random secret; shared by portal + policy module |
| `INSPECTION_EMBED_SECRET` | Strong random (or reuse policy secret via portal fallback) |

## Portal-only recommended

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SITE_URL` | `https://bteg.inspect.mn` |
| `NEXT_PUBLIC_INSPECT_URL` | Inspection Vercel origin |
| `NEXT_PUBLIC_POLICY_URL` | Policy Vercel origin |
| `NEXT_PUBLIC_DEVELOPMENT_URL` | Development Vercel origin |
| `POLICY_EMBED_SECRET_PREVIOUS` | Optional rotation window |
| `INSPECTION_EMBED_SECRET_PREVIOUS` | Optional rotation window |

## Verify after Preview deploy

1. `GET /api/runtime-info` ΓåÆ `hasServiceRole: true`, `hasPolicyEmbedSecret: true`, masked ref matches `inspect-bteg`
2. `GET /api/supabase/health` ΓåÆ ok
3. Open `/inspection` and `/policy-compliance` as a signed-in user (embed tokens issue)
4. Confirm anon PostgREST cannot select `app_data_store` after migration apply

## Do not

- Put service role in `NEXT_PUBLIC_*`
- Rely on hardcoded embed default (removed in Batch 1)
- Point portal URL at SmartMine project `hlidcdaaxmdhisdfkaca`
