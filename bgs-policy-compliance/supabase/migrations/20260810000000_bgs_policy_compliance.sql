-- BGS Policy Compliance System schema
-- Spec: bgs_policy_compliance_cursor_spec.md

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.policy_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.responsibility_type as enum (
    'IMPLEMENTATION',
    'MONITORING',
    'VERIFICATION',
    'DEPLOYMENT'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.compliance_status as enum (
    'not_started',
    'in_progress',
    'partially_compliant',
    'compliant',
    'non_compliant',
    'not_applicable'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.org_unit_type as enum (
    'organization',
    'gazar',
    'heltes',
    'alba',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_role as enum (
    'admin',
    'evaluator',
    'viewer'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.org_units (
  id uuid primary key default gen_random_uuid(),
  bteg_id text,
  name text not null,
  unit_type public.org_unit_type not null default 'other',
  parent_id uuid references public.org_units(id) on delete set null,
  parent_bteg_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists org_units_bteg_type_uidx
  on public.org_units (bteg_id, unit_type)
  where bteg_id is not null;

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  approved_date date,
  reference_code text,
  status public.policy_status not null default 'active',
  version integer not null default 1,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_sections (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  text text,
  reference_number text,
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policy_sections_policy_idx
  on public.policy_sections (policy_id);

create table if not exists public.policy_clauses (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  section_id uuid references public.policy_sections(id) on delete set null,
  parent_id uuid references public.policy_clauses(id) on delete cascade,
  reference_number text,
  text text not null default '',
  sort_order integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policy_clauses_policy_idx on public.policy_clauses (policy_id);
create index if not exists policy_clauses_section_idx on public.policy_clauses (section_id);
create index if not exists policy_clauses_parent_idx on public.policy_clauses (parent_id);

create table if not exists public.job_positions (
  id uuid primary key default gen_random_uuid(),
  bteg_id text,
  name text not null,
  organization_id text,
  gazar_id text,
  heltes_id text,
  alba_id text,
  org_unit_id uuid references public.org_units(id) on delete set null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_positions_name_idx on public.job_positions (name);
create index if not exists job_positions_bteg_idx on public.job_positions (bteg_id);

create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  job_position_id uuid not null references public.job_positions(id) on delete cascade,
  title text,
  a_code text,
  purpose text,
  schedule text,
  daily_hours text,
  break_time text,
  duties jsonb not null default '[]'::jsonb,
  education_level text,
  work_experience text,
  general_skills jsonb not null default '[]'::jsonb,
  professional_skills jsonb not null default '[]'::jsonb,
  authority text,
  responsibilities text,
  relevant_laws jsonb not null default '[]'::jsonb,
  job_condition text,
  resources text,
  communication_scope jsonb,
  supervisor_positions jsonb not null default '[]'::jsonb,
  subordinate_positions jsonb not null default '[]'::jsonb,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_descriptions_position_idx
  on public.job_descriptions (job_position_id);

create table if not exists public.policy_scope_targets (
  id bigserial primary key,
  policy_id uuid not null references public.policies(id) on delete cascade,
  target_type text not null,
  target_bteg_id text,
  target_name text,
  parent_bteg_id text,
  org_unit_id uuid references public.org_units(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists policy_scope_targets_policy_idx
  on public.policy_scope_targets (policy_id);

create table if not exists public.clause_position_responsibilities (
  id uuid primary key default gen_random_uuid(),
  policy_clause_id uuid not null references public.policy_clauses(id) on delete cascade,
  job_position_id uuid not null references public.job_positions(id) on delete cascade,
  responsibility_type public.responsibility_type not null,
  is_checked boolean not null default true,
  is_active boolean not null default true,
  weight numeric(6,2) not null default 1,
  required_evidence text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_clause_id, job_position_id, responsibility_type)
);

create index if not exists cpr_clause_idx
  on public.clause_position_responsibilities (policy_clause_id);
create index if not exists cpr_position_idx
  on public.clause_position_responsibilities (job_position_id);
create index if not exists cpr_type_idx
  on public.clause_position_responsibilities (responsibility_type);

create table if not exists public.compliance_evaluations (
  id uuid primary key default gen_random_uuid(),
  policy_clause_id uuid not null references public.policy_clauses(id) on delete cascade,
  job_position_id uuid not null references public.job_positions(id) on delete cascade,
  responsibility_type public.responsibility_type not null,
  evaluation_period text not null,
  period_start date,
  period_end date,
  evaluator_user_id uuid references public.users(id) on delete set null,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  status public.compliance_status not null default 'not_started',
  comment text,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eval_clause_idx on public.compliance_evaluations (policy_clause_id);
create index if not exists eval_position_idx on public.compliance_evaluations (job_position_id);
create index if not exists eval_period_idx on public.compliance_evaluations (evaluation_period);

create table if not exists public.evaluation_evidence (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.compliance_evaluations(id) on delete cascade,
  evidence_type text not null default 'text',
  title text,
  content text,
  url text,
  file_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists evaluation_evidence_eval_idx
  on public.evaluation_evidence (evaluation_id);

create table if not exists public.audit_log (
  id bigserial primary key,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- Inspect integration placeholders (adapter layer owns mapping details)
create table if not exists public.inspect_policy_clause_links (
  id uuid primary key default gen_random_uuid(),
  inspect_record_id text not null,
  policy_clause_id uuid not null references public.policy_clauses(id) on delete cascade,
  mapping_notes text,
  created_at timestamptz not null default now(),
  unique (inspect_record_id, policy_clause_id)
);

create table if not exists public.inspect_evidence_links (
  id uuid primary key default gen_random_uuid(),
  inspect_record_id text not null,
  evaluation_id uuid references public.compliance_evaluations(id) on delete set null,
  evidence_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'inspect',
  source_record_id text,
  policy_clause_id uuid references public.policy_clauses(id) on delete set null,
  job_position_id uuid references public.job_positions(id) on delete set null,
  title text not null,
  status text not null default 'open',
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
create or replace view public.v_policy_clause_responsibility_matrix as
select
  p.id as policy_id,
  p.name as policy_name,
  p.reference_code,
  pc.id as clause_id,
  pc.reference_number,
  pc.text as clause_text,
  cpr.id as responsibility_id,
  cpr.responsibility_type,
  cpr.is_checked,
  cpr.is_active,
  cpr.weight,
  jp.id as job_position_id,
  jp.name as job_position_name,
  jp.heltes_id,
  jp.alba_id,
  jp.gazar_id
from public.policies p
join public.policy_clauses pc on pc.policy_id = p.id and pc.is_deleted = false
left join public.clause_position_responsibilities cpr
  on cpr.policy_clause_id = pc.id and cpr.is_active = true
left join public.job_positions jp on jp.id = cpr.job_position_id
where p.is_deleted = false;

create or replace view public.v_position_policy_obligations as
select
  jp.id as job_position_id,
  jp.name as job_position_name,
  p.id as policy_id,
  p.name as policy_name,
  pc.id as clause_id,
  pc.reference_number,
  pc.text as clause_text,
  cpr.responsibility_type,
  cpr.weight,
  cpr.required_evidence
from public.job_positions jp
join public.clause_position_responsibilities cpr
  on cpr.job_position_id = jp.id and cpr.is_active = true
join public.policy_clauses pc on pc.id = cpr.policy_clause_id and pc.is_deleted = false
join public.policies p on p.id = pc.policy_id and p.is_deleted = false;

create or replace view public.v_clause_compliance_latest as
select distinct on (ce.policy_clause_id, ce.job_position_id, ce.responsibility_type)
  ce.*
from public.compliance_evaluations ce
order by ce.policy_clause_id, ce.job_position_id, ce.responsibility_type, ce.evaluated_at desc;

create or replace view public.v_policy_compliance_summary as
select
  p.id as policy_id,
  p.name as policy_name,
  count(distinct pc.id) as clause_count,
  count(distinct cpr.job_position_id) as linked_position_count,
  count(distinct cpr.id) as responsibility_link_count,
  count(distinct ce.id) as evaluation_count,
  round(avg(latest.score)::numeric, 2) as avg_score
from public.policies p
left join public.policy_clauses pc on pc.policy_id = p.id and pc.is_deleted = false
left join public.clause_position_responsibilities cpr
  on cpr.policy_clause_id = pc.id and cpr.is_active = true
left join public.compliance_evaluations ce on ce.policy_clause_id = pc.id
left join public.v_clause_compliance_latest latest on latest.policy_clause_id = pc.id
where p.is_deleted = false
group by p.id, p.name;

create or replace view public.v_position_compliance_summary as
select
  jp.id as job_position_id,
  jp.name as job_position_name,
  count(distinct cpr.policy_clause_id) as clause_count,
  count(distinct pc.policy_id) as policy_count,
  count(*) filter (where cpr.responsibility_type = 'IMPLEMENTATION') as implementation_count,
  count(*) filter (where cpr.responsibility_type = 'MONITORING') as monitoring_count,
  count(*) filter (where cpr.responsibility_type = 'VERIFICATION') as verification_count,
  count(*) filter (where cpr.responsibility_type = 'DEPLOYMENT') as deployment_count,
  round(avg(latest.score)::numeric, 2) as avg_score
from public.job_positions jp
left join public.clause_position_responsibilities cpr
  on cpr.job_position_id = jp.id and cpr.is_active = true
left join public.policy_clauses pc on pc.id = cpr.policy_clause_id
left join public.v_clause_compliance_latest latest
  on latest.job_position_id = jp.id
where jp.is_active = true
group by jp.id, jp.name;

create or replace view public.v_department_compliance_summary as
select
  coalesce(ou.name, coalesce(jp.heltes_id, jp.alba_id, jp.gazar_id, 'Unassigned')) as department_key,
  ou.id as org_unit_id,
  count(distinct jp.id) as position_count,
  count(distinct cpr.policy_clause_id) as clause_obligation_count,
  count(distinct pc.policy_id) as policy_count,
  round(avg(latest.score)::numeric, 2) as avg_score,
  round(avg(latest.score) filter (where latest.responsibility_type = 'IMPLEMENTATION')::numeric, 2) as implementation_score,
  round(avg(latest.score) filter (where latest.responsibility_type = 'MONITORING')::numeric, 2) as monitoring_score,
  round(avg(latest.score) filter (where latest.responsibility_type = 'VERIFICATION')::numeric, 2) as verification_score
from public.job_positions jp
left join public.org_units ou on ou.id = jp.org_unit_id
left join public.clause_position_responsibilities cpr
  on cpr.job_position_id = jp.id and cpr.is_active = true
left join public.policy_clauses pc on pc.id = cpr.policy_clause_id
left join public.v_clause_compliance_latest latest on latest.job_position_id = jp.id
where jp.is_active = true
group by coalesce(ou.name, coalesce(jp.heltes_id, jp.alba_id, jp.gazar_id, 'Unassigned')), ou.id;
