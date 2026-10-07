-- =============================================================================
-- DRAFT — NOT EXECUTED — NOT PRODUCTION AUTHORIZED
-- RBAC-V2 E1 rollback DDL (dependency-safe; reverse of forward draft)
-- Valid ONLY before v2 tables become authoritative (pre-E5 cutover).
--
-- Rollback safety assumes G1 preflight drift guards passed before forward apply
-- (validation A3 + A9–A13). Therefore every column/function/constraint dropped
-- here was created by E1, not inherited from the staging baseline.
--
-- C4: No DROP ... CASCADE on v2 tables. Unexpected dependents must FAIL
-- the rollback rehearsal rather than silently disappearing.
-- Does NOT drop legacy: roles, permissions (table), role_permissions,
-- user_profiles (table), access_requests, temporary_edit_grants, app_data_store.
-- Does NOT DROP EXTENSION pgcrypto (shared; not E1-owned — Option A).
-- =============================================================================

BEGIN;

-- 1) Remove profile projections that reference orgs / units / positions
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_primary_unit_org_fkey;

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS rbac_v2_ready,
  DROP COLUMN IF EXISTS primary_position_id,
  DROP COLUMN IF EXISTS primary_organizational_unit_id,
  DROP COLUMN IF EXISTS primary_organization_id;

-- 2) Remove positions → rbac_roles suggestion FK
ALTER TABLE public.positions
  DROP COLUMN IF EXISTS default_role_id;

-- 3) Drop grant / assignment tables (children first; no CASCADE)
DROP TABLE IF EXISTS public.temporary_grants;
DROP TABLE IF EXISTS public.user_permission_overrides;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.rbac_role_permissions;

-- 4) Drop rbac_roles (must succeed only if default_role_id already gone)
DROP TABLE IF EXISTS public.rbac_roles;

-- 5) Drop membership / user_position / position graph
DROP TABLE IF EXISTS public.user_positions;
DROP TABLE IF EXISTS public.user_org_memberships;
DROP TABLE IF EXISTS public.position_aliases;
DROP TABLE IF EXISTS public.positions;

-- 6) Drop unit aliases, then integrity trigger/function, then units / orgs
DROP TABLE IF EXISTS public.organizational_unit_aliases;

DROP TRIGGER IF EXISTS organizational_units_parent_guard_trg
  ON public.organizational_units;

DROP FUNCTION IF EXISTS public.rbac_v2_org_unit_parent_guard();

DROP TABLE IF EXISTS public.organizational_units;
DROP TABLE IF EXISTS public.organizations;

-- 7) Remove staged permissions columns (additive metadata only)
DROP INDEX IF EXISTS public.permissions_status_idx;
DROP INDEX IF EXISTS public.permissions_module_idx;

ALTER TABLE public.permissions
  DROP CONSTRAINT IF EXISTS permissions_status_check,
  DROP CONSTRAINT IF EXISTS permissions_scope_mode_check;

ALTER TABLE public.permissions
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS is_sensitive,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS scope_mode,
  DROP COLUMN IF EXISTS action,
  DROP COLUMN IF EXISTS resource;

COMMIT;

-- =============================================================================
-- END DRAFT — NOT EXECUTED — NOT PRODUCTION AUTHORIZED
-- NOTE: pgcrypto extension is left installed (shared); do not DROP EXTENSION.
-- If DROP TABLE fails due to an unexpected dependent object, investigate —
-- do NOT re-add CASCADE to “force” success.
-- =============================================================================
