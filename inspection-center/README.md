# Inspection Center

Web app that converts Excel-based inspection checklists (Хяналт шалгалтын хуудас) into structured workflows: templates, plans, runs, scoring, findings, corrective actions, evidence, and analytics.

## Quick start

```bash
npm install
npm run import:excel
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/dashboard`.

## Excel import

Default workbook:

`C:\Users\Owner\.openclaw\media\inbound\TEST_2026-04-23---c681df84-7f14-477b-b352-a5b94766a6b7.xlsm`

```bash
npm run import:excel:list
npm run import:excel
# optional custom path:
npx tsx scripts/import-excel.ts "D:\path\to\file.xlsm"
```

Writes `data/imported-templates.json`. The app store (`data/store.json`) loads templates on first read and seeds a demo run.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind 4
- Local JSON store (no DB required for v1)
- SheetJS (`xlsx`) importer for `.xlsm`

## Spec

See `C:\Users\Owner\platform\docs\inspection_center_build_spec.md`

Platform portal: `C:\Users\Owner\platform\inspect-mn`

Canonical path for this module: `C:\Users\Owner\platform\inspection-center`

Reference UI (do not modify): `C:\Users\Owner\inspect-mn`

## Integration

`src/lib/integration/policy-compliance.ts` defines the contract for `bgs-policy-compliance` (`policy_clause_id` on findings, evidence/action feeds).
