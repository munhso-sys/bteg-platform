# Inspect-MN Platform Portal

Дотоод үйл ажиллагааны **бүрэн UI апп** (`C:\Users\Owner\platform\inspect-mn`).

Зургийн мэдээллийн архитектур — бүх 9 модуль портал дотор шууд нээгдэнэ:
- **ҮҮРЭГ** — Хяналт шалгалт, Журмын биелэлт, Судалгаа хөгжүүлэлт
- **ҮР ДҮН / TOOLS** — үр дүнгийн болон хэрэгслийн модулиуд

Local URL / workspace path хэрэглэгчийн UI дээр харагдахгүй. Менюгээс шууд модулийн самбар руу орно.

## Local development

```bash
cd C:\Users\Owner\platform\inspect-mn
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Stable mode:** бүх 9 модуль энэ нэг апп дотор ажиллана. Sibling apps/iframe шаардлагагүй.

## Routes

| Route | Menu |
|-------|------|
| `/` | Dashboard |
| `/inspection` | Хяналт шалгалт |
| `/policy-compliance` | Журмын биелэлт |
| `/development` | Судалгаа хөгжүүлэлт |
| `/employee-voice` | Ажилтны дуу хоолой |
| `/risk-management` | Эрсдэлийн удирдлага |
| `/report-analysis` | Тайлан шинжилгээ |
| `/smartmine` | SmartMine (самбар, боловсруулалт, тоног төхөөрөмж, засвар, Reason Tool) |
| `/ai-assistant` | AI туслах |
| `/settings` | Тохиргоо |
| `/management-center` | Удирдлагын төв |

## Environment variables

Copy `.env.local.example` → `.env.local`.

| Variable | Required now | Notes |
|----------|--------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Legacy anon JWT key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional | Modern publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | No (prep) | Server-only; never expose to browser |
| `NEXT_PUBLIC_INSPECT_URL` | Optional | Default `http://localhost:3001` |
| `NEXT_PUBLIC_POLICY_URL` | Optional | Default `http://localhost:3002` |
| `SMARTMINE_SUPABASE_URL` | For SmartMine | Default `https://hlidcdaaxmdhisdfkaca.supabase.co` |
| `SMARTMINE_SUPABASE_SERVICE_ROLE_KEY` | For SmartMine | Server-only; reads canonical views |
| `SMARTMINE_ORGANIZATION_ID` | Optional | Default `BAYANGOL` |

**Do not deploy** until Supabase project IDs and Vercel credentials are confirmed.

See also `../docs/SUPABASE_CONNECTION.md` for the active project (`bteg-smartmine-mvp`).

## Supabase connection plan

1. Connected via MCP account linked to org `barulas` (user hint: `corporation0214-hue`).
2. Active project: `bteg-smartmine-mvp` (`hlidcdaaxmdhisdfkaca`).
3. Env vars are in each app `.env.local` (not committed).
4. Portal `/settings` and `/api/supabase/health` show live connection status.
5. Free-tier project limit is full (2/2). Pause/upgrade an existing project before creating a dedicated `inspect-mn-platform` DB.
6. Keep `service_role` only in server routes when needed; never expose to browser.

## Vercel deployment

Production project: `platform-portal` (account `munhso-9795s-projects`)

- Production URL: https://platform-portal-blue.vercel.app
- Inspector: https://vercel.com/munhso-9795s-projects/platform-portal

Redeploy:

```bash
cd C:\Users\Owner\platform\inspect-mn
npx vercel --prod --yes
```

Note: ҮҮРЭГ module embeds still point to local ports until those apps are also deployed and `NEXT_PUBLIC_*_URL` env vars are updated on Vercel.

Do **not** overwrite the older Vercel project named `inspect-mn` (SmartMine).
## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- lucide-react

## Note on other `inspect-mn`

`C:\Users\Owner\inspect-mn` is a separate existing SmartMine app and was **not** modified. This portal lives only under `C:\Users\Owner\platform\inspect-mn`.
