# Inspection Center Build Spec

## Goal

Build a new `inspection-center` system under `C:\Users\Owner\platform\inspection-center`.

Do not modify the current production/reference project at `C:\Users\Owner\inspect-mn`. Use it only for UI/workflow reference.

The attached Excel workbook `TEST_2026-04-23.xlsm` is the main reference for the first build. It contains the current inspection forms and dashboards used for:

- Хяналт шалгалтын хуудас
- Төрийн байгууллагын хяналт шалгалт
- Шөнийн хяналт шалгалт
- Хамтарсан хяналт шалгалт
- Төлөвлөгөөт бус / бусад хяналт шалгалт
- Гүйцэтгэл, зөрчил, зөрчил арилгалт, эрсдэл, тайлан, төлөвлөгөө

The new system must convert these Excel-based workflows into a web application with structured database records, CRUD, scoring, evidence, analytics, and integration with `bgs-policy-compliance`.

## Excel Analysis Summary

Workbook path inspected:

`C:\Users\Owner\.openclaw\media\inbound\TEST_2026-04-23---c681df84-7f14-477b-b352-a5b94766a6b7.xlsm`

Workbook structure:

- Total sheets: 145
- Visible sheets: 41
- Hidden sheets: 104

Important visible sheets:

- `HOME` - overall structure and high-level dashboard
- `ХШХ` - хяналт шалгалтын хуудасны main dashboard
- `ХШХ-1` - хяналтын хуудасны category/list reference
- `ХШТөрийн` - төрийн байгууллагын хяналт шалгалт
- `ХШШөнийн` - шөнийн хяналт шалгалт
- `ХШХамтарсан` - хамтарсан хяналт шалгалтын summary
- `ХШХамтарсан (2)` - хамтарсан хяналтын org/month matrix
- `ХШБусад` - төлөвлөгөөт бус / бусад ХШ

Visible inspection checklist sheets include:

- `5.13` Шатахуун түгээх станцын үйл ажиллагаа
- `4.1.7`, `4.1.8`, `4.1.9`, `4.1.12` тээвэр, аюултай ачаа, суудлын автомашин
- `4.2.4`, `4.2.7` авто зам
- `6.1`, `6.3`, `6.4`, `6.6`, `6.8`, `6.9`, `6.11` уул уурхай, баяжуулах, тэсрэх бодис, геологи, маркшейдер, шатахуун
- `1.1.4`, `1.1.5`, `1.1.6`, `10.7.1` байгаль орчин, хог хаягдал, цэвэрлэх байгууламж
- `7.1.1`, `7.1.2`, `7.2.1`, `7.3.1` хөдөлмөр, ХАБ, эрүүл ахуй, нийгмийн хамгаалал
- `2.1.1`, `2.1.2`, `2.5.4`, `9.1`, `9.2`, `9.3`, `5.25`, `11.1.5`, `11.1.6`, `12.1.1` барилга, эрчим хүч, мэдээлэл холбоо, хэмжил зүй

Common checklist sheet structure:

- Header:
  - checklist number/title
  - inspection owner: `МХГ`, `ДХШ`, `БОАЖЯ`, etc.
  - inspection date
  - applicable question count
  - passed question count
  - compliance percentage
  - failed question count
  - failed score
  - risk percentage
  - risk level: `Бага`, `Дунд`, etc.
- Question table:
  - `№`
  - `Хууль тогтоомж, дүрэм, журам, стандартын нэр, зүйл, заалт`
  - `Хяналт шалгалтын асуултууд`
  - `Батлагдсан оноо`
  - repeated inspection result columns:
    - planned inspection score
    - actual received score
    - execution inspection score
- Execution / corrective action area:
  - `Гүйцэтгэл`
  - `Явц, %`
  - `Хариуцлагын түвшин`
  - `Хариуцсан ажилтан`
  - `Илгээх хугацаа`
  - `Тайлбар`
  - `Хийгдэх ажил`
  - `Эхлэх`
  - `Дуусах`

This repeated form pattern should become a reusable web checklist template engine, not 30 separate hardcoded pages.

## Product Scope

The first version must support:

- Importing existing Excel checklist structures into normalized data
- Managing inspection checklist templates
- Creating inspection plans
- Performing inspections from templates
- Recording question-level scores
- Recording violations and nonconformities
- Assigning corrective actions
- Tracking action progress and due dates
- Uploading evidence
- Calculating implementation/compliance/risk scores
- Producing dashboards by inspection type, checklist, department, unit, employee, and date
- Linking inspection findings to policy clauses in `bgs-policy-compliance`

## Target Folder

Create and work inside:

`C:\Users\Owner\platform\inspection-center`

Reference only:

`C:\Users\Owner\inspect-mn`

Related system:

`C:\Users\Owner\platform\bgs-policy-compliance`

Shared contracts:

`C:\Users\Owner\platform\shared`

Docs:

`C:\Users\Owner\platform\docs`

## Inspection Types

Use an enum/table for inspection type:

- `CHECKLIST` - Хяналт шалгалтын хуудас
- `STATE_INSPECTION` - Төрийн байгууллагын ХШ
- `NIGHT_INSPECTION` - Шөнийн ХШ
- `JOINT_INSPECTION` - Хамтарсан ХШ
- `UNPLANNED_INSPECTION` - Төлөвлөгөөт бус / бусад ХШ
- `DOCUMENT_INSPECTION` - Баримт бичгийн ХШ, future

Each type shares common inspection logic but can have specialized fields and dashboards.

## Core Data Model

Recommended tables/entities:

- `inspection_templates`
  - id
  - code: e.g. `6.1`, `7.1.2`, `5.13`
  - title
  - category
  - source_sheet_name
  - regulatory_source
  - active
  - version

- `inspection_template_sections`
  - id
  - template_id
  - parent_id nullable
  - section_no
  - title
  - order_index

- `inspection_template_questions`
  - id
  - template_id
  - section_id nullable
  - question_no
  - legal_reference
  - question_text
  - approved_score
  - order_index
  - active

- `inspection_plans`
  - id
  - title
  - inspection_type
  - year
  - month nullable
  - planned_date
  - target_org_unit_id nullable
  - target_department_id nullable
  - target_location_id nullable
  - responsible_team_id nullable
  - status: draft/planned/in_progress/completed/cancelled

- `inspection_runs`
  - id
  - plan_id nullable
  - template_id nullable
  - inspection_type
  - title
  - inspected_by_org: e.g. `ДХШ`, `МХГ`, `БОАЖЯ`
  - inspection_date
  - target_org_unit_id nullable
  - target_department_id nullable
  - target_location_id nullable
  - lead_inspector_id
  - status
  - notes

- `inspection_answers`
  - id
  - run_id
  - template_question_id
  - is_applicable
  - approved_score
  - received_score
  - compliance_status: pass/fail/partial/not_applicable
  - comment
  - answered_by
  - answered_at

- `inspection_findings`
  - id
  - run_id
  - answer_id nullable
  - finding_type: violation/nonconformity/observation/risk
  - severity: low/medium/high/critical
  - title
  - description
  - source_text
  - target_org_unit_id nullable
  - target_department_id nullable
  - target_job_position_id nullable
  - policy_clause_id nullable
  - status: open/in_progress/resolved/closed

- `corrective_actions`
  - id
  - finding_id
  - action_text
  - responsible_employee_id nullable
  - responsible_job_position_id nullable
  - responsible_org_unit_id nullable
  - progress_percent
  - start_date
  - due_date
  - completed_date nullable
  - status: assigned/in_progress/submitted/verified/closed/overdue
  - manager_comment

- `inspection_evidence`
  - id
  - run_id
  - answer_id nullable
  - finding_id nullable
  - action_id nullable
  - file_url
  - file_type
  - caption
  - uploaded_by
  - uploaded_at

- `inspection_score_snapshots`
  - id
  - run_id
  - applicable_question_count
  - passed_question_count
  - failed_question_count
  - approved_score_total
  - received_score_total
  - compliance_percent
  - failed_score_total
  - risk_percent
  - risk_level

## Scoring Logic

Checklist scoring:

```text
applicable_question_count = count(answers where is_applicable = true)
passed_question_count = count(answers where is_applicable = true and received_score >= approved_score)
failed_question_count = applicable_question_count - passed_question_count
approved_score_total = sum(approved_score where is_applicable = true)
received_score_total = sum(received_score where is_applicable = true)
compliance_percent = received_score_total / approved_score_total
failed_score_total = approved_score_total - received_score_total
risk_percent = failed_score_total / approved_score_total
```

Risk level mapping:

- `0% - 30%` = `Бага`
- `30% - 60%` = `Дунд`
- `60% - 100%` = `Их`

Allow these thresholds to be configurable because the Excel may use different future business rules.

Corrective action progress:

```text
finding_progress = average(corrective_actions.progress_percent)
run_action_completion = closed_actions / total_actions
department_action_completion = closed_actions_by_department / total_actions_by_department
```

## Main Screens

### Dashboard

Must match the Excel `HOME` and screenshot concept, but as a web dashboard.

Sections:

- Inspection overview
- Planned vs actual inspections
- Violations
- Resolved violations
- Compliance score
- Risk score
- Night inspection summary
- Joint inspection summary
- State inspection summary
- Checklist implementation summary
- Corrective action progress

Filters:

- year
- month/quarter
- inspection type
- department/alba/heltes
- location
- inspector
- risk level
- status

### Inspection Template Library

List all imported checklist templates.

Features:

- search by code/title/category
- view template
- create/edit/deactivate template
- import from Excel
- version templates
- manage questions
- manage approved scores

### Inspection Run

Create and perform an inspection.

Flow:

1. Select inspection type
2. Select template or specialized form
3. Select target org/location/department
4. Assign inspectors
5. Fill question-level answers
6. Auto-calculate score/risk
7. Create findings from failed questions
8. Attach evidence
9. Assign corrective actions
10. Submit/complete inspection

### Findings

Kanban/table view:

- open
- in progress
- submitted
- verified
- closed
- overdue

Each finding must link back to:

- inspection run
- checklist question
- org unit/location/department
- policy clause, when applicable
- corrective actions
- evidence

### Corrective Actions

Action tracking view:

- action text
- responsible person/job position
- due date
- progress
- evidence
- verification
- overdue flags

### Specialized Forms

#### State Inspection

Reference: `ХШТөрийн`

Fields:

- government agency
- checklist number
- checklist title
- date
- failed score
- risk percentage
- implementation percentage
- violation count
- execution status
- responsible employee
- progress
- due date
- comment

#### Night Inspection

Reference: `ХШШөнийн`

Fields:

- month group
- inspection count
- violation count
- resolved count
- unresolved/nonconformity category
- location
- employee count
- equipment count
- issue category
- department/unit

Dashboard:

- monthly night inspection count
- violation trend
- resolved percentage
- top nonconformity categories
- location breakdown

#### Joint Inspection

Reference: `ХШХамтарсан`, `ХШХамтарсан (2)`

Fields:

- year
- participating department/category: БО, ХАБ, ХЭА, ДХШ, etc.
- inspection target
- issue category
- violation count
- resolved count
- organization/unit matrix

Dashboard:

- category distribution
- department matrix
- yearly/monthly trend
- top issue categories

#### Unplanned Inspection

Reference: `ХШБусад`

Fields:

- trigger/source
- reason
- target
- findings
- actions
- evidence

## Integration With BGS Policy Compliance

The inspection center must not duplicate policy compliance. It should expose inspection evidence and findings to `bgs-policy-compliance`.

Integration contract:

- `inspection_findings.policy_clause_id` links a finding to a policy clause
- `inspection_evidence` can be reused as compliance evidence
- `corrective_actions` can be linked to a clause-position obligation
- inspection score can feed:
  - policy clause implementation score
  - department compliance dashboard
  - job-position compliance dashboard

Shared event/interface examples:

```ts
type InspectionFindingLinkedToPolicyClause = {
  findingId: string
  inspectionRunId: string
  policyClauseId: string
  targetOrgUnitId?: string
  targetJobPositionId?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
}
```

## Excel Import Requirements

Create importer scripts under:

`C:\Users\Owner\platform\inspection-center\scripts`

Importer must:

- read `.xlsm` workbook
- list visible sheets
- identify checklist template sheets by code-like sheet names such as `6.1`, `7.1.2`, `5.13`
- extract title from row 1
- extract header metrics from rows 2-10
- extract question table from row 11/12 onward
- normalize checklist questions into `inspection_template_questions`
- preserve `source_sheet_name`, `source_cell_ref`, and raw text for auditability
- ignore hidden sheets by default, but keep an option to inspect/import hidden reference data later

Do not hardcode every checklist. Build a parser based on the common column pattern:

- legal reference column
- question column
- approved score columns
- repeated inspection result columns
- execution/corrective action columns

## UI Style

Use a serious internal operations style:

- dense but readable dashboard
- orange identity for Inspection Center
- no landing page
- no decorative hero
- tables, filters, tabs, split panes, status badges
- chart cards only for actual metrics
- inspection forms should feel like a fast data-entry tool

Expected navigation:

- Dashboard
- Inspection Plans
- Inspection Runs
- Checklist Templates
- Findings
- Corrective Actions
- Evidence
- Analytics
- Imports
- Settings

## Cursor First Prompt

Use this as the first prompt in Cursor:

```text
Build the new Inspection Center under:
C:\Users\Owner\platform\inspection-center

Do not modify:
C:\Users\Owner\inspect-mn

Use the old inspect-mn only as a reference for visual patterns and existing inspection concepts.

Read this spec first:
C:\Users\Owner\platform\docs\inspection_center_build_spec.md

The attached Excel workbook is the reference for current inspection forms:
C:\Users\Owner\.openclaw\media\inbound\TEST_2026-04-23---c681df84-7f14-477b-b352-a5b94766a6b7.xlsm

Create a web app for the Inspection Center with:
- inspection dashboard
- checklist template library
- inspection plan CRUD
- inspection run workflow
- question-level scoring
- findings/nonconformities
- corrective actions
- evidence attachments
- analytics
- Excel import script
- integration contract with bgs-policy-compliance

Important workbook facts:
- 145 sheets total
- 41 visible sheets
- visible dashboard/form sheets: HOME, ХШХ, ХШХ-1, ХШТөрийн, ХШШөнийн, ХШХамтарсан, ХШХамтарсан (2), ХШБусад
- visible checklist sheets include 5.13, 4.1.7, 4.1.8, 4.1.9, 4.1.12, 4.2.4, 4.2.7, 6.1, 6.3, 6.4, 6.6, 6.8, 1.1.5, 1.1.4, 1.1.6, 7.1.1, 7.1.2, 10.12.1, 2.1.2, 2.1.1, 7.2.1, 7.3.1, 10.7.1, 2.5.4, 11.1.6, 6.9, 6.11, 12.1.1, 9.2, 9.1, 11.1.5, 5.25, 9.3

First implement:
1. Project scaffold
2. Data model/types
3. Excel import script that lists visible sheets and extracts checklist templates/questions
4. Dashboard page based on the Excel HOME/ХШХ screenshot
5. Checklist template list/detail page
6. Inspection run form with scoring

Keep the implementation modular so bgs-policy-compliance can consume inspection findings/evidence later.
```

## Acceptance Criteria

- Old `C:\Users\Owner\inspect-mn` remains untouched
- Excel visible sheets can be listed by the import script
- Checklist templates can be imported from visible code-named sheets
- Checklist questions are stored as structured records
- User can create an inspection run from a template
- User can score each question
- System auto-calculates compliance percent and risk percent
- Failed questions can generate findings
- Findings can generate corrective actions
- Evidence can be attached to runs, answers, findings, and actions
- Dashboard shows inspection count, violation count, resolved count, compliance, risk, and action progress
- Findings can optionally link to `policy_clause_id` for policy compliance integration

