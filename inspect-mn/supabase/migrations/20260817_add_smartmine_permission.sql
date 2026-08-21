insert into public.permissions (id, label, module, description)
values (
  'module.smartmine.view',
  'SmartMine харах',
  'smartmine',
  'SmartMine dashboard, боловсруулалт, тоног төхөөрөмж, засварын мэдээлэл харах'
)
on conflict (id) do update
set
  label = excluded.label,
  module = excluded.module,
  description = excluded.description;

-- Preserve current access: roles that could open Result modules keep SmartMine access.
insert into public.role_permissions (role_id, permission_id)
select distinct role_id, 'module.smartmine.view'
from public.role_permissions
where permission_id = 'module.results.view'
on conflict (role_id, permission_id) do nothing;
