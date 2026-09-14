-- Process files, DFD nodes, matrix rows (expand). Runtime v1 uses JSON store.
-- Do not apply to production without explicit approval.

create table if not exists public.process_files (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.process_nodes (id) on delete cascade,
  file_name text not null,
  original_name text not null,
  file_type text not null,
  mime_type text not null default 'application/octet-stream',
  file_path text not null,
  size_bytes bigint not null default 0,
  version text not null default '1.0',
  previous_file_id uuid null references public.process_files (id) on delete set null,
  is_current boolean not null default true,
  process_owner text null,
  module_category text not null default 'OTHER',
  checksum text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists process_files_process_id_idx on public.process_files (process_id);

create table if not exists public.dfd_nodes (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.process_nodes (id) on delete cascade,
  diagram_node_id text not null,
  label text not null,
  dfd_level text not null,
  element_kind text not null,
  data_input jsonb not null default '[]'::jsonb,
  data_output jsonb not null default '[]'::jsonb,
  data_store_reference text null,
  api_payload_schema text null,
  data_dictionary jsonb not null default '{}'::jsonb,
  notes text null,
  file_id uuid null references public.process_files (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dfd_nodes_process_diagram_idx
  on public.dfd_nodes (process_id, diagram_node_id);

create table if not exists public.process_matrix (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.process_nodes (id) on delete cascade,
  file_id uuid null references public.process_files (id) on delete set null,
  matrix_kind text not null,
  sheet_name text null,
  step_number integer null,
  task_name text not null,
  input_data text null,
  process_text text null,
  output_data text null,
  role_matrix jsonb not null default '{}'::jsonb,
  responsible_role text null,
  accountable_role text null,
  consulted_role text null,
  informed_role text null,
  diagram_node_id text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists process_matrix_process_id_idx on public.process_matrix (process_id);

alter table public.process_files enable row level security;
alter table public.dfd_nodes enable row level security;
alter table public.process_matrix enable row level security;
