# BGS export folder structure

Generated: 2026-07-19
Source: https://bgs-mn.vercel.app/job-descriptions and related Supabase public REST tables

```text
BGS_job_descriptions_policies_export_2026-07-19/
  00_INDEX/
    all_manifest.csv
    job_descriptions_manifest.csv
    policies_manifest.csv
    manifest.xlsx
    folder-structure.md
    summary.json
  01_RAW_JSON/
    job_description.json
    job_position.json
    policy.json
    policy_scope_targets.json
  Job_descriptions/
    <Organization>/
      <Department>/
        <Unit>/
          <occupation-code>_<job-position>.md
  Policies/
    <Department|Unit|Uncategorized>/
      <scope-name>/
        <reference-code>_<policy-name>.md
```

Notes:
- Job descriptions are grouped by the job_position relation: organization > department > unit.
- Policies are grouped by policy_scope_targets. A policy connected to multiple units/departments appears in each relevant folder.
- Policy detail endpoint `/api/policy?id=<id>` exposed section/clause content; policy markdown files include full section and clause text.
