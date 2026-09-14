-- Mirror of process/supabase/migrations/20260914000000_process_nodes.sql
-- Portal-owned migrations folder for review before production apply.
-- Runtime v1 uses process/data/store.json — do not apply to production without approval.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.process_node_level as enum (
    'L1_MACRO',
    'L2_SUBPROCESS',
    'L3_ACTIVITY',
    'L4_TASK'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.process_node_status as enum (
    'ACTIVE',
    'DRAFT',
    'ARCHIVED'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.process_root_cause_category as enum (
    'PROCESS_GAP',
    'HUMAN_ERROR',
    'EQUIPMENT_FAILURE',
    'ENVIRONMENTAL'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.process_nodes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  description text not null default '',
  level public.process_node_level not null,
  parent_id uuid null references public.process_nodes (id) on delete set null,
  location_id text null,
  asset_id text null,
  status public.process_node_status not null default 'DRAFT',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint process_nodes_code_unique unique (code),
  constraint process_nodes_no_self_parent check (parent_id is distinct from id)
);

create index if not exists process_nodes_parent_id_idx
  on public.process_nodes (parent_id);

create index if not exists process_nodes_status_idx
  on public.process_nodes (status);

create index if not exists process_nodes_location_id_idx
  on public.process_nodes (location_id);

alter table public.process_nodes enable row level security;
