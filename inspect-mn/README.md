# Inspect-MN Platform Portal

Дотоод үйл ажиллагааны портал (`inspect-mn`). Local-д дөрвөн sibling Next.js аппыг **iframe**-ээр embed хийнэ; production дээр мөн адил Vercel origin-ууд руу холбогдоно. Энэ нь нэг апп дотор бүх модуль ажиллах setup **биш**.

## Ports

| App | Path | Port | Portal env |
|-----|------|------|------------|
| Portal | `inspect-mn` | 3000 | `NEXT_PUBLIC_SITE_URL=http://localhost:3000` |
| Хяналт шалгалт | `inspection-center` | 3001 | `NEXT_PUBLIC_INSPECT_URL=http://localhost:3001` |
| Журмын биелэлт | `bgs-policy-compliance` | 3002 | `NEXT_PUBLIC_POLICY_URL=http://localhost:3002` |
| Судалгаа хөгжүүлэлт | `development` | 3003 | `NEXT_PUBLIC_DEVELOPMENT_URL=http://localhost:3003` |
| Процесс | `process` | 3004 | `NEXT_PUBLIC_PROCESS_URL=http://localhost:3004` |

## Local development

```powershell
# From repo root
.\scripts\start-duty-modules.ps1
cd inspect-mn
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Менюгээс модулийн самбар руу шууд орно. Local URL / workspace path хэрэглэгчийн UI дээр харагдахгүй.

## Sidebar modules

Портал sidebar-т модулиуд (`src/lib/modules.ts`). Дөрвөн ҮҮРЭГ embed-д sibling апп хэрэгтэй; бусад нь портал process дотор ажиллана.

| Route | Menu | Group |
|-------|------|-------|
| `/` | Dashboard | — |
| `/inspection` | Хяналт шалгалт | ҮҮРЭГ (iframe → :3001) |
| `/policy-compliance` | Журмын биелэлт | ҮҮРЭГ (iframe → :3002) |
| `/guidance` | Удирдамж | ҮҮРЭГ |
| `/development` | Судалгаа хөгжүүлэлт | ҮҮРЭГ (iframe → :3003) |
| `/process` | Процесс | ҮҮРЭГ (iframe → :3004) |
| `/employee-voice` | Ажилтны дуу хоолой | ҮР ДҮН |
| `/risk-management` | Эрсдэлийн удирдлага | ҮР ДҮН |
| `/report-analysis` | Тайлан шинжилгээ | ҮР ДҮН |
| `/smartmine` | SmartMine | ҮР ДҮН |
| `/ai-assistant` | AI туслах | TOOLS |
| `/policy-review` | Баримт харьцуулалт | TOOLS |
| `/glossary` | Толь бичиг | TOOLS |
| `/glossary/database` | Толь бичиг — үндсэн мэдээлэл | TOOLS |
| `/settings` | Тохиргоо | TOOLS |
| `/management-center` | Удирдлагын төв | TOOLS |

## Environment variables

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

- `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (do **not** use production site URL for local auth redirects)
- Duty module `NEXT_PUBLIC_*_URL` → localhost ports above

| Variable | Required now | Notes |
|----------|--------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Legacy anon JWT key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional | Modern publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | No (prep) | Server-only; never expose to browser |
| `POLICY_EMBED_SECRET` | Yes (duty embeds) | Same on portal + policy module |
| `INSPECTION_EMBED_SECRET` | Yes (duty embeds) | Same on portal + inspection-center |
| `NEXT_PUBLIC_INSPECT_URL` | Local duty | Default `http://localhost:3001` |
| `NEXT_PUBLIC_POLICY_URL` | Local duty | Default `http://localhost:3002` |
| `NEXT_PUBLIC_DEVELOPMENT_URL` | Local duty | Default `http://localhost:3003` |
| `NEXT_PUBLIC_PROCESS_URL` | Local duty | Default `http://localhost:3004` |
| `SMARTMINE_SUPABASE_URL` | For SmartMine | Separate SmartMine project if used |
| `SMARTMINE_SUPABASE_SERVICE_ROLE_KEY` | For SmartMine | Server-only |
| `SMARTMINE_ORGANIZATION_ID` | Optional | Org scope for SmartMine |

Optional:

- Policy: keep local `bgs-policy-compliance/data/local/db.json` (gitignored). Refresh: `cd bgs-policy-compliance && npm run data:refresh`
- IC: keep `inspection-center/data/store.json` (gitignored). Dev prefers local FS store.
- Do not set `USE_REMOTE_STORE=1` against Production while experimenting with writes.

See also `../docs/SUPABASE_CONNECTION.md` and `../HOW_TO_OPEN_DUTY_MODULES.md`.

## Safety

- Local only: no GitHub push, no Vercel deploy, no Production Supabase mutations unless explicitly instructed.
- Keep `service_role` only in server routes; never expose to browser.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- lucide-react
