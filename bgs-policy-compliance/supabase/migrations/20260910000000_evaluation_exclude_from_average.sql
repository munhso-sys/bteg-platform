-- Expand: mark evaluations that must not affect averages (attention / exception notes).
alter table public.compliance_evaluations
  add column if not exists exclude_from_average boolean not null default false;

comment on column public.compliance_evaluations.exclude_from_average is
  'When true, score is stored for audit but excluded from policy/position averages; surfaces as attention item.';

create index if not exists compliance_evaluations_exclude_from_average_idx
  on public.compliance_evaluations (exclude_from_average)
  where exclude_from_average = true;
