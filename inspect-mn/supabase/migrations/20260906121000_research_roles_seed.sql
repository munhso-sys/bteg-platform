-- Local/QA helpers for Research RLS regression (synthetic users).
-- Not applied to production automatically; used by local tests.

insert into public.roles (id, label, sort_order)
values
  ('admin', 'Admin', 1),
  ('manager', 'Manager', 2),
  ('inspector', 'Inspector', 3)
on conflict (id) do nothing;
