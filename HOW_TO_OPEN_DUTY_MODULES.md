# How to open duty modules (local)

Local portal embeds three sibling Next.js apps via iframe. Production embeds the same apps on their Vercel origins. This is **not** a single-app “all modules inside inspect-mn” setup.

## Ports

| App | Path | Port | Portal env |
|-----|------|------|------------|
| Portal | `inspect-mn` | 3000 | `NEXT_PUBLIC_SITE_URL=http://localhost:3000` |
| Хяналт шалгалт | `inspection-center` | 3001 | `NEXT_PUBLIC_INSPECT_URL=http://localhost:3001` |
| Журмын биелэлт | `bgs-policy-compliance` | 3002 | `NEXT_PUBLIC_POLICY_URL=http://localhost:3002` |
| Судалгаа хөгжүүлэлт | `development` | 3003 | `NEXT_PUBLIC_DEVELOPMENT_URL=http://localhost:3003` |

## Start

```powershell
# From repo root
.\scripts\start-duty-modules.ps1
cd inspect-mn
npm run dev
```

Open http://localhost:3000

## Required local env (no secrets in git)

Copy each app’s `.env.example` → `.env.local` and fill values, **or** from repo root:

```powershell
node scripts\sync-local-env.cjs
```

That sets `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, copies public Supabase keys into duty modules, and generates matching embed secrets if missing (does not print secrets).

Shared across portal + duty modules:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable)
- `POLICY_EMBED_SECRET` — **same value** on portal and `bgs-policy-compliance`
- `INSPECTION_EMBED_SECRET` — **same value** on portal and `inspection-center` (or reuse policy secret)

Portal-only for local:

- `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (do **not** use `https://bteg.inspect.mn` for local auth redirects)
- Duty module `NEXT_PUBLIC_*_URL` → localhost ports above

Optional:

- `SUPABASE_SERVICE_ROLE_KEY` — admin approve / remote JSON stores (never `NEXT_PUBLIC_*`)
- Policy: keep local `data/local/db.json` (gitignored). Refresh: `cd bgs-policy-compliance && npm run data:refresh`
- IC: keep `inspection-center/data/store.json` (gitignored). Dev prefers local FS store.

## Sidebar modules

Portal sidebar lists **12** modules (`inspect-mn/src/lib/modules.ts`). Three duty embeds need sibling apps; others run inside the portal process.

## Safety

- Local only: no GitHub push, no Vercel deploy, no Production Supabase mutations unless explicitly instructed.
- Do not point local `USE_REMOTE_STORE=1` at Production while experimenting with writes.
