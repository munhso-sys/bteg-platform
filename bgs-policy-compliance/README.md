# Журмын биелэлт

Журам, ажлын байрны биелэлтийн үнэлгээний дотоод систем (BGS экспортын суурьтай).

## Stack

- Next.js App Router + TypeScript
- Local JSON store (works offline) + Supabase Postgres migrations ready
- Tailwind CSS, Recharts, Zod
- Inspect adapter stubs for later integration

## Location

Migrated to: `C:\Users\Owner\platform\bgs-policy-compliance`

Platform portal bridge: `http://localhost:3000/policy-compliance`

## Quick start

```bash
npm install
npm run import:bgs
npm run dev -- -p 3002
```

Open [http://localhost:3002](http://localhost:3002) → redirects to `/org`.

Default import source:

`C:\Users\Owner\Desktop\260710\Research\BGS_job_descriptions_policies_export_2026-07-19`

Override:

```bash
npm run import:bgs -- "D:\path\to\export"
```

## Import baseline

| Entity | Count |
|--------|------:|
| Policies | 73 |
| Job positions | 618 |
| Job descriptions | 53 |
| Responsibility links | 2,417 |
| Clauses | 5,835 |

## Routes

- `/org` хэлтэс → алба → журам / ажлын байр
- `/dashboard` executive KPIs + data quality
- `/policies`, `/policies/[id]`, `/policies/[id]/matrix`
- `/positions`, `/positions/[id]`
- `/clauses/[id]`
- `/matrix`, `/evaluations`
- `/imports`, `/settings`, `/login`

## Supabase

Apply `supabase/migrations/20260810000000_bgs_policy_compliance.sql` when a project is ready.
Until then the app reads/writes `data/local/db.json`.

## Inspect integration

Placeholder service functions live in `src/lib/inspect/adapter.ts`.
Reserved tables: `inspect_policy_clause_links`, `inspect_evidence_links`, `corrective_actions`.
