# Inspection Center Master Workbook Delta - 2026-08-11

## Workbook

Source file:

`C:\Users\Owner\.openclaw\media\inbound\ХШ---3be8ab4c-7ae7-4737-94f6-e87c83633f3d.xlsx`

This workbook is not the same shape as the earlier macro workbook that carried the 33 checklist template sheets. It contains master/reference and inspection tracking sheets:

- `ХШШөнийн` - night inspection matrix
- `ХШХамтарсан` - joint inspection checklist
- `ХШТөрийн` - state authority inspection tracker
- `ХШХ-1` - checklist catalog/reference

Generated normalized artifact:

`C:\Users\Owner\platform\inspection-center\data\imported-master-sheets.json`

Importer command:

```bash
npm run import:master -- "C:/Users/Owner/.openclaw/media/inbound/ХШ---3be8ab4c-7ae7-4737-94f6-e87c83633f3d.xlsx"
```

## Sheet Counts

- Total sheets: 4
- Hidden sheets: 0
- `ХШШөнийн`: 1015 rows x 680 columns
- `ХШХамтарсан`: 42 rows x 4 columns
- `ХШТөрийн`: 31 rows x 16 columns
- `ХШХ-1`: 39 rows x 8 columns

## Normalized Extraction

- Checklist catalog records from `ХШХ-1`: 37
- Joint inspection items from `ХШХамтарсан`: 39
- State inspection tracker rows from `ХШТөрийн`: 23
- Night inspection question/item rows from `ХШШөнийн`: 48

## Product Implication

Keep the earlier 33 checklist template import as the source for question-level regulatory templates.

Use this workbook as supporting operational data:

- `ХШХ-1` becomes the checklist catalog mapping department/org unit to checklist code/title.
- `ХШТөрийн` becomes `STATE_INSPECTION` plan/run seed data with authority, checklist code, date, risk, violation count, responsible employee, progress, and due date.
- `ХШХамтарсан` becomes a reusable `JOINT_INSPECTION` checklist template with categories:
  - Байгаль орчин
  - ХАБЭА
  - Хүнсний эрүүл ахуй
  - Дотоод хяналт шалгалт
- `ХШШөнийн` becomes a reusable `NIGHT_INSPECTION` operational checklist/matrix. The sheet is wide because location/date result columns repeat horizontally; the first import captures the canonical item rows only.

## Implementation Note

The app now has a separate CLI importer for these master sheets:

`C:\Users\Owner\platform\inspection-center\scripts\import-master-workbook.ts`

It writes `data/imported-master-sheets.json` and does not overwrite `data/imported-templates.json`, so the checklist template engine remains intact.
