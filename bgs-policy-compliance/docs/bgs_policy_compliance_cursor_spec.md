# BGS Policy Compliance System - Cursor Build Spec

## Goal

Build an internal web application that reproduces the useful data/UI behavior of the existing BGS policy site from the available export, but extends it into a full policy compliance management system.

This is not only a read-only viewer. The system must support creating and editing:

- Policies / procedures
- Policy sections, clauses, and nested sub-clauses
- Job positions
- Job descriptions
- Clause-to-position responsibility links
- Clause implementation/compliance evaluations
- Analytics dashboards by policy, clause, job position, department, unit, and role level

The system will later connect with the previous Inspect system. Design integration points cleanly.

## Existing Data Inputs

Use the current export files as seed data:

- `BGS_export.zip`
- `01_RAW_JSON/policy.json`
- `01_RAW_JSON/policy_full_details.json`
- `01_RAW_JSON/policy_scope_targets.json`
- `01_RAW_JSON/job_position.json`
- `01_RAW_JSON/job_description.json`
- Generated export:
  - `out/bgs_clause_position_links.csv`

Important nested relationship from `policy_full_details.json`:

```text
policy
  -> section[]
    -> clause[]
      -> children[] recursively
      -> clause_position[]
          -> job_position_id
          -> type
          -> is_checked
```

Role type mapping:

- `IMPLEMENTATION` = гүйцэтгэх
- `MONITORING` = хянах / шалгах
- `VERIFICATION` = баталгаажуулах
- `DEPLOYMENT` = хэрэгжүүлэх / нэвтрүүлэх

Keep enum values in English internally and display Mongolian labels in the UI.

## Recommended Stack

- Next.js App Router
- TypeScript
- Supabase Postgres
- Supabase Auth or app-level auth if Supabase auth is not ready
- Tailwind CSS
- shadcn/ui
- lucide-react icons
- TanStack Table for dense list views
- Recharts for dashboards
- Zod for validation

Use Supabase migrations or SQL files for schema. Seed from JSON/CSV via scripts.

## Core Concepts

### Policy

A policy/procedure document with metadata:

- id
- name
- approved_date
- reference_code
- status: draft, active, archived
- version
- is_deleted
- created_at
- updated_at

### Policy Structure

Policies are hierarchical:

- policy_section
- policy_clause
- policy_clause.children via `parent_id`

Each clause must support:

- reference_number, for example `1.1`, `1.1.1`
- text
- parent clause
- ordering
- active/deleted state

### Job Position

Job position metadata:

- id
- bteg_id
- name
- organization_id
- gazar_id
- heltes_id
- alba_id
- is_active
- created_at
- updated_at

### Job Description

Job descriptions are attached to job positions:

- job_position_id
- title
- purpose
- schedule
- daily_hours
- break_time
- duties
- education_level
- work_experience
- general_skills
- professional_skills
- authority
- responsibilities
- relevant_laws
- job_condition
- resources
- supervisor positions
- subordinate positions

### Clause Responsibility Link

This is the most important relationship.

Each policy clause can be linked to multiple job positions with responsibility type:

- policy_clause_id
- job_position_id
- responsibility_type
- is_checked / active
- weight
- required_evidence
- notes

Responsibility type:

- IMPLEMENTATION
- MONITORING
- VERIFICATION
- DEPLOYMENT

This link defines which job position is responsible for implementing, checking, approving/verifying, or deploying a clause.

### Compliance Evaluation

Evaluations measure clause implementation. An evaluation is always tied to:

- policy_clause_id
- job_position_id
- responsibility_type
- evaluation_period
- evaluator_user_id
- score
- status
- evidence
- comment

Score should support 0-100 numeric scoring plus status labels:

- not_started
- in_progress
- partially_compliant
- compliant
- non_compliant
- not_applicable

Recommended scoring rule:

- 0 = not_started / no evidence
- 25 = weak implementation
- 50 = partial implementation
- 75 = mostly implemented
- 100 = fully compliant

Allow custom score but display it consistently.

## Database Model

Create normalized tables:

```sql
policies
policy_sections
policy_clauses
job_positions
job_descriptions
org_units
policy_scope_targets
clause_position_responsibilities
compliance_evaluations
evaluation_evidence
users
user_roles
audit_log
```

Suggested additional views:

```sql
v_policy_clause_responsibility_matrix
v_position_policy_obligations
v_policy_compliance_summary
v_position_compliance_summary
v_department_compliance_summary
v_clause_compliance_latest
```

## Main Workflows

### 1. Policy Import

Import existing BGS policy data from JSON.

Requirements:

- Preserve original ids where possible.
- Recursively import nested clauses.
- Import `clause_position` links.
- Validate missing positions.
- Produce import report with counts.

Expected imported baseline from current export:

- 73 policies
- 618 job positions
- 53 job descriptions
- 2,417 clause-position responsibility links
- 5,835 total clauses/sub-clauses discovered during recursive traversal

### 2. Policy CRUD

Admin users can:

- Create policy
- Edit policy metadata
- Add section
- Add clause
- Add nested sub-clause
- Reorder sections/clauses
- Archive policy
- Duplicate policy as new version

Clause editor must support:

- Reference number
- Rich text/plain text
- Responsibility links
- Evaluation settings

### 3. Job Position CRUD

Admin users can:

- Add job position
- Edit job position
- Attach to organization/department/unit
- Add/edit job description
- Deactivate position

Position detail page must show:

- Job description
- All policy clauses linked to this position
- Responsibility type by clause
- Latest evaluation score
- Trend over time

### 4. Clause Responsibility Mapping

On each clause, users can assign job positions by level:

- Гүйцэтгэх
- Хянах / шалгах
- Баталгаажуулах
- Хэрэгжүүлэх / нэвтрүүлэх

UI should allow:

- Search position by name, department, unit
- Multi-select positions
- Assign role type
- Set weight
- Set evidence requirement
- Remove or deactivate link

### 5. Evaluation Workflow

Evaluators score clause implementation for a job position.

Minimum fields:

- Period: month/quarter/custom date range
- Score 0-100
- Status
- Evidence files/links/text
- Comment
- Evaluator
- Evaluated at

Support evaluation from two entry points:

- Policy clause detail: evaluate all linked positions
- Job position detail: evaluate all obligations for that position

### 6. Dashboards

Build dashboards for:

#### Executive Overview

KPI cards:

- Total policies
- Total clauses
- Total job positions
- Total responsibility links
- Evaluation completion rate
- Average compliance score
- Non-compliant clause count
- High-risk departments

Charts:

- Compliance trend by month
- Compliance by responsibility type
- Top/bottom departments
- Top/bottom job positions
- Policy coverage heatmap

#### Policy Dashboard

For each policy:

- Clause count
- Linked position count
- Evaluation coverage
- Average score
- Score by section
- Score by responsibility type
- Weakest clauses
- Positions with missing evaluations

#### Department / Unit Dashboard

For each organization unit:

- Assigned policy count
- Clause obligation count
- Average implementation score
- Monitoring score
- Verification score
- Overdue evaluations
- Top non-compliant clauses

#### Job Position Dashboard

For each job position:

- Total linked clauses
- Policy count
- Implementation obligations
- Monitoring obligations
- Verification obligations
- Latest compliance score
- Missing evidence count
- Trend chart

#### Matrix View

Policy x job position matrix:

- Rows: policies / clauses
- Columns: positions or departments
- Cell: role type + latest score
- Filters: policy, department, role type, score range, evaluation status

## Inspect System Integration

The new system should be designed to connect with the previous Inspect system.

Expected integration patterns:

### Option A: Evidence Import

Inspect records become evidence for compliance evaluations.

Mapping idea:

```text
inspect_record
  -> policy_clause_id
  -> job_position_id
  -> evidence
  -> observed_score / issue_count
```

### Option B: Finding-to-Clause Mapping

Inspection findings can be mapped to policy clauses.

Example:

- Inspect finding: missing PPE
- Related policy clause: PPE usage clause
- Responsible position: HSE specialist, department supervisor
- Result: compliance score reduced or review required

### Option C: Shared Dashboards

Dashboards combine:

- Policy compliance evaluation
- Inspect findings
- Corrective action status
- Department/unit score

Create integration tables:

```sql
inspect_policy_clause_links
inspect_evidence_links
corrective_actions
```

Do not hard-code Inspect schema until actual schema is known. Use an adapter/service layer.

## UI Pages

Create these routes:

```text
/login
/dashboard
/policies
/policies/new
/policies/[id]
/policies/[id]/edit
/policies/[id]/matrix
/clauses/[id]
/positions
/positions/new
/positions/[id]
/positions/[id]/edit
/job-descriptions
/evaluations
/evaluations/new
/matrix
/departments
/departments/[id]
/imports
/settings
```

## UI Design Guidance

This is an operational compliance system, not a marketing site.

Use:

- Dense, clear dashboards
- Tables with filters and saved views
- Side panel details
- Compact badges for responsibility type
- Score chips with color thresholds
- Tree view for policy clauses
- Breadcrumbs
- Tabs for detail pages
- Export buttons

Avoid:

- Oversized landing page
- Decorative hero sections
- Card-heavy marketing layouts
- Unnecessary gradients

## Data Quality Checks

Show warnings for:

- Clauses with no linked position
- Positions with no policy obligations
- Positions with no job description
- Responsibility links without active position
- Evaluations without evidence
- Duplicate position names
- Malformed reference codes
- Non-normalized job conditions and daily hours

## Acceptance Criteria

The system is acceptable when:

1. Existing BGS export can be imported without losing nested clauses.
2. Clause-position links are visible by responsibility type.
3. A user can create a new policy, add clauses, and assign job positions by role.
4. A user can create a new job position and job description.
5. A user can evaluate a clause for a position with score, status, evidence, and comment.
6. Dashboards show compliance by policy, job position, department, and role type.
7. Position detail shows all policy obligations for that position.
8. Policy detail shows all linked job positions per clause.
9. CSV export works for responsibility matrix and evaluation results.
10. Inspect integration has documented adapter tables and placeholder service functions.

## Cursor First Prompt

Use this as the first prompt in Cursor:

```text
Build a Next.js + TypeScript + Supabase internal policy compliance management system from this spec.

Start by creating:
1. Database schema/migrations for policies, sections, clauses, job positions, job descriptions, clause-position responsibilities, compliance evaluations, evidence, org units, users/roles, and audit logs.
2. Seed/import scripts for BGS_export.zip raw JSON files and out/bgs_clause_position_links.csv.
3. Core pages:
   - /dashboard
   - /policies
   - /policies/[id]
   - /positions
   - /positions/[id]
   - /matrix
   - /evaluations
4. Recursive policy clause tree rendering.
5. CRUD flows for policy, clause, job position, job description, responsibility links, and evaluations.
6. Dashboard views for policy compliance, position compliance, department compliance, and role-type compliance.

Use shadcn/ui, lucide-react, TanStack Table, Recharts, and Zod.
Keep UI dense, operational, and suitable for repeated internal work.
Do not make a landing page.
The first screen after login should be the dashboard.
```

