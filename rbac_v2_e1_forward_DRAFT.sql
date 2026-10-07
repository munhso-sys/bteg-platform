-- =============================================================================
-- DRAFT — NOT EXECUTED — NOT PRODUCTION AUTHORIZED
-- RBAC-V2 E1 forward DDL (WP-01 + WP-02 additive schema)
-- Authority: RBAC-V2-G0-PHYSICAL-SCHEMA-REVIEW.md + G1-PREP-R2 drift guards
-- Do NOT apply to production without explicit G1 + later production gates.
--
-- OWNERSHIP / DRIFT:
-- Preflight A3 + A9–A13 MUST PASS before this script. E1 uses plain CREATE /
-- ADD COLUMN (not IF NOT EXISTS / CREATE OR REPLACE) so unexpected baseline
-- drift fails loudly. pgcrypto / gen_random_uuid() is a DBA prerequisite
-- (Option A) — this script does NOT install or remove the shared extension.
-- =============================================================================

BEGIN;

-- Prerequisite (Option A): gen_random_uuid() must already work. No CREATE EXTENSION.

-- -----------------------------------------------------------------------------
-- Scope storage: text + CHECK (not Postgres ENUM) for migration flexibility
-- Allowed scope_type: own | assigned | department | department_tree |
-- organization | all. No `none`.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- 001 WP-01: organizations
-- =============================================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_code_key UNIQUE (code)
);

COMMENT ON TABLE public.organizations IS 'RBAC v2 tenant root — E1 draft';

-- =============================================================================
-- 002 WP-01: organizational_units
-- =============================================================================
CREATE TABLE public.organizational_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  parent_id uuid NULL REFERENCES public.organizational_units (id) ON DELETE RESTRICT,
  unit_type text NOT NULL,
  code text NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizational_units_unit_type_check
    CHECK (unit_type = ANY (ARRAY[
      'organization'::text,
      'gazar'::text,
      'heltes'::text,
      'alba'::text,
      'other'::text
    ])),
  -- Composite uniqueness for same-org FKs from children
  CONSTRAINT organizational_units_id_org_key UNIQUE (id, organization_id)
);

CREATE INDEX organizational_units_organization_id_idx
  ON public.organizational_units (organization_id);
CREATE INDEX organizational_units_parent_id_idx
  ON public.organizational_units (parent_id);
CREATE INDEX organizational_units_unit_type_idx
  ON public.organizational_units (unit_type);
CREATE UNIQUE INDEX organizational_units_org_code_uidx
  ON public.organizational_units (organization_id, code)
  WHERE code IS NOT NULL;

-- Same-org parent + cycle prevention (E1-owned; preflight A11 proves absence)
CREATE FUNCTION public.rbac_v2_org_unit_parent_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_org uuid;
  v_walk uuid;
  v_guard int := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'organizational_units: parent_id cannot equal id';
  END IF;

  SELECT organization_id INTO v_parent_org
  FROM public.organizational_units
  WHERE id = NEW.parent_id;

  IF v_parent_org IS NULL THEN
    RAISE EXCEPTION 'organizational_units: parent_id % not found', NEW.parent_id;
  END IF;

  IF v_parent_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'organizational_units: parent must belong to same organization_id';
  END IF;

  -- Cycle: walk ancestors; fail if we reach NEW.id
  v_walk := NEW.parent_id;
  WHILE v_walk IS NOT NULL LOOP
    v_guard := v_guard + 1;
    IF v_guard > 64 THEN
      RAISE EXCEPTION 'organizational_units: parent chain too deep or cyclic';
    END IF;
    IF v_walk = NEW.id THEN
      RAISE EXCEPTION 'organizational_units: parent cycle detected';
    END IF;
    SELECT parent_id INTO v_walk
    FROM public.organizational_units
    WHERE id = v_walk;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER organizational_units_parent_guard_trg
  BEFORE INSERT OR UPDATE OF parent_id, organization_id, id
  ON public.organizational_units
  FOR EACH ROW
  EXECUTE PROCEDURE public.rbac_v2_org_unit_parent_guard();

COMMENT ON FUNCTION public.rbac_v2_org_unit_parent_guard() IS
  'E1: same-org parent + cycle guard — DRAFT';

-- =============================================================================
-- 003 WP-01: organizational_unit_aliases
-- =============================================================================
CREATE TABLE public.organizational_unit_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizational_unit_id uuid NOT NULL
    REFERENCES public.organizational_units (id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizational_unit_aliases_source_external_uidx
    UNIQUE (source, external_id)
);

CREATE INDEX organizational_unit_aliases_unit_id_idx
  ON public.organizational_unit_aliases (organizational_unit_id);

-- =============================================================================
-- 004 WP-01: positions (NO default_role_id)
-- =============================================================================
CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE RESTRICT,
  organizational_unit_id uuid NULL,
  title text NOT NULL,
  code text NULL,
  default_scope_type text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT positions_default_scope_type_check
    CHECK (
      default_scope_type IS NULL
      OR default_scope_type = ANY (ARRAY[
        'own'::text,
        'assigned'::text,
        'department'::text,
        'department_tree'::text,
        'organization'::text,
        'all'::text
      ])
    ),
  -- Same-org unit integrity (MATCH SIMPLE: skipped when unit is NULL)
  CONSTRAINT positions_unit_org_fkey
    FOREIGN KEY (organizational_unit_id, organization_id)
    REFERENCES public.organizational_units (id, organization_id)
    ON DELETE RESTRICT
);

CREATE INDEX positions_organization_id_idx ON public.positions (organization_id);
CREATE INDEX positions_organizational_unit_id_idx
  ON public.positions (organizational_unit_id);
CREATE UNIQUE INDEX positions_org_code_uidx
  ON public.positions (organization_id, code)
  WHERE code IS NOT NULL;

-- =============================================================================
-- 005 WP-01: position_aliases
-- =============================================================================
CREATE TABLE public.position_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL
    REFERENCES public.positions (id) ON DELETE CASCADE,
  source text NOT NULL,
  external_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT position_aliases_source_external_uidx UNIQUE (source, external_id)
);

CREATE INDEX position_aliases_position_id_idx
  ON public.position_aliases (position_id);

-- =============================================================================
-- 006 WP-01: user_org_memberships
-- =============================================================================
CREATE TABLE public.user_org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.user_profiles (user_id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL
    REFERENCES public.organizations (id) ON DELETE RESTRICT,
  organizational_unit_id uuid NOT NULL,
  membership_kind text NOT NULL,
  is_primary boolean NOT NULL,
  status text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz NULL,
  granted_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_org_memberships_kind_check
    CHECK (membership_kind = ANY (ARRAY[
      'primary'::text, 'secondary'::text, 'temporary_org'::text
    ])),
  CONSTRAINT user_org_memberships_status_check
    CHECK (status = ANY (ARRAY[
      'active'::text, 'ended'::text, 'revoked'::text
    ])),
  CONSTRAINT user_org_memberships_primary_kind_check
    CHECK ((NOT is_primary) OR membership_kind = 'primary'),
  CONSTRAINT user_org_memberships_effective_window_check
    CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT user_org_memberships_unit_org_fkey
    FOREIGN KEY (organizational_unit_id, organization_id)
    REFERENCES public.organizational_units (id, organization_id)
    ON DELETE RESTRICT
);

CREATE INDEX user_org_memberships_user_status_idx
  ON public.user_org_memberships (user_id, status);
CREATE INDEX user_org_memberships_unit_id_idx
  ON public.user_org_memberships (organizational_unit_id);
CREATE UNIQUE INDEX user_org_memberships_one_active_primary_uidx
  ON public.user_org_memberships (user_id)
  WHERE status = 'active' AND is_primary;

-- =============================================================================
-- 007 WP-01: user_positions
-- =============================================================================
CREATE TABLE public.user_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.user_profiles (user_id) ON DELETE RESTRICT,
  position_id uuid NOT NULL
    REFERENCES public.positions (id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_positions_status_check
    CHECK (status = ANY (ARRAY[
      'active'::text, 'ended'::text, 'revoked'::text
    ])),
  CONSTRAINT user_positions_effective_window_check
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE UNIQUE INDEX user_positions_one_active_primary_uidx
  ON public.user_positions (user_id)
  WHERE status = 'active' AND is_primary;

CREATE INDEX user_positions_user_status_idx
  ON public.user_positions (user_id, status);

-- =============================================================================
-- 008 WP-02: rbac_roles (no seed rows)
-- =============================================================================
CREATE TABLE public.rbac_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  label text NOT NULL,
  description text NULL,
  kind text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  legacy_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rbac_roles_code_key UNIQUE (code),
  CONSTRAINT rbac_roles_kind_check
    CHECK (kind = ANY (ARRAY['preset'::text, 'custom'::text]))
);

CREATE UNIQUE INDEX rbac_roles_legacy_code_uidx
  ON public.rbac_roles (legacy_code)
  WHERE legacy_code IS NOT NULL;

-- =============================================================================
-- 009 WP-02: permissions staged expansion (legacy rows survive)
-- Preflight A9/A12 prove E1 target columns/constraint/index names are absent.
-- Plain ADD — fails loudly on drift (no IF NOT EXISTS / DROP IF EXISTS reconcile).
-- =============================================================================
ALTER TABLE public.permissions
  ADD COLUMN resource text NULL,
  ADD COLUMN action text NULL,
  ADD COLUMN scope_mode text NULL,
  ADD COLUMN status text NULL,
  ADD COLUMN is_sensitive boolean NULL DEFAULT false,
  ADD COLUMN updated_at timestamptz NULL DEFAULT now();

ALTER TABLE public.permissions
  ADD CONSTRAINT permissions_scope_mode_check
  CHECK (
    scope_mode IS NULL
    OR scope_mode = ANY (ARRAY['required'::text, 'not_applicable'::text])
  );

ALTER TABLE public.permissions
  ADD CONSTRAINT permissions_status_check
  CHECK (
    status IS NULL
    OR status = ANY (ARRAY[
      'active'::text, 'legacy'::text, 'deprecated'::text
    ])
  );

-- Mark existing rows transitional (additive metadata only)
UPDATE public.permissions
SET status = 'legacy', updated_at = now()
WHERE status IS NULL;

CREATE INDEX permissions_status_idx ON public.permissions (status);
CREATE INDEX permissions_module_idx ON public.permissions (module);

-- NOTE: Do NOT add identity CHECK id = module.resource.action — breaks mega-keys.

-- =============================================================================
-- 010 WP-02: rbac_role_permissions
-- =============================================================================
CREATE TABLE public.rbac_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL
    REFERENCES public.rbac_roles (id) ON DELETE CASCADE,
  permission_id text NOT NULL
    REFERENCES public.permissions (id) ON DELETE RESTRICT,
  scope_type text NULL,
  scope_ref uuid NULL
    REFERENCES public.organizational_units (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rbac_role_permissions_scope_type_check
    CHECK (
      scope_type IS NULL
      OR scope_type = ANY (ARRAY[
        'own'::text,
        'assigned'::text,
        'department'::text,
        'department_tree'::text,
        'organization'::text,
        'all'::text
      ])
    ),
  CONSTRAINT rbac_role_permissions_scope_ref_type_check
    CHECK (
      scope_ref IS NULL
      OR scope_type = ANY (ARRAY['department'::text, 'department_tree'::text])
    )
);

-- Multiple scope rows per role+permission (null-safe)
CREATE UNIQUE INDEX rbac_role_permissions_role_perm_scope_uidx
  ON public.rbac_role_permissions (
    role_id,
    permission_id,
    COALESCE(scope_type, ''),
    COALESCE(scope_ref, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX rbac_role_permissions_role_id_idx
  ON public.rbac_role_permissions (role_id);
CREATE INDEX rbac_role_permissions_permission_id_idx
  ON public.rbac_role_permissions (permission_id);

-- Cross-table scope_mode validation: NOT in E1 (server E1–E4; trigger E5+)

-- =============================================================================
-- 011 WP-02: user_roles
-- =============================================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.user_profiles (user_id) ON DELETE RESTRICT,
  role_id uuid NOT NULL
    REFERENCES public.rbac_roles (id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL,
  status text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz NULL,
  granted_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_source_check
    CHECK (source = ANY (ARRAY[
      'manual'::text,
      'provisioning'::text,
      'migration'::text,
      'access_request'::text
    ])),
  CONSTRAINT user_roles_status_check
    CHECK (status = ANY (ARRAY[
      'active'::text, 'ended'::text, 'revoked'::text
    ])),
  CONSTRAINT user_roles_effective_window_check
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX user_roles_user_status_idx ON public.user_roles (user_id, status);
CREATE UNIQUE INDEX user_roles_one_active_primary_uidx
  ON public.user_roles (user_id)
  WHERE status = 'active' AND is_primary;

-- =============================================================================
-- 012 WP-02: user_permission_overrides
-- =============================================================================
CREATE TABLE public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.user_profiles (user_id) ON DELETE RESTRICT,
  permission_id text NOT NULL
    REFERENCES public.permissions (id) ON DELETE RESTRICT,
  effect text NOT NULL,
  scope_type text NULL,
  scope_ref uuid NULL
    REFERENCES public.organizational_units (id) ON DELETE RESTRICT,
  reason text NOT NULL,
  granted_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_permission_overrides_effect_check
    CHECK (effect = ANY (ARRAY['allow'::text, 'deny'::text])),
  CONSTRAINT user_permission_overrides_status_check
    CHECK (status = ANY (ARRAY[
      'active'::text, 'ended'::text, 'revoked'::text
    ])),
  CONSTRAINT user_permission_overrides_scope_type_check
    CHECK (
      scope_type IS NULL
      OR scope_type = ANY (ARRAY[
        'own'::text,
        'assigned'::text,
        'department'::text,
        'department_tree'::text,
        'organization'::text,
        'all'::text
      ])
    ),
  CONSTRAINT user_permission_overrides_scope_ref_type_check
    CHECK (
      scope_ref IS NULL
      OR scope_type = ANY (ARRAY['department'::text, 'department_tree'::text])
    ),
  CONSTRAINT user_permission_overrides_effective_window_check
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX user_permission_overrides_user_perm_status_idx
  ON public.user_permission_overrides (user_id, permission_id, status);

-- =============================================================================
-- 013 WP-02: temporary_grants (ALLOW only; empty replacement for edit-only legacy)
-- =============================================================================
CREATE TABLE public.temporary_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.user_profiles (user_id) ON DELETE RESTRICT,
  permission_id text NOT NULL
    REFERENCES public.permissions (id) ON DELETE RESTRICT,
  scope_type text NULL,
  scope_ref uuid NULL
    REFERENCES public.organizational_units (id) ON DELETE RESTRICT,
  resource_type text NULL,
  resource_id text NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  granted_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT temporary_grants_window_check CHECK (ends_at > starts_at),
  CONSTRAINT temporary_grants_scope_type_check
    CHECK (
      scope_type IS NULL
      OR scope_type = ANY (ARRAY[
        'own'::text,
        'assigned'::text,
        'department'::text,
        'department_tree'::text,
        'organization'::text,
        'all'::text
      ])
    ),
  CONSTRAINT temporary_grants_scope_ref_type_check
    CHECK (
      scope_ref IS NULL
      OR scope_type = ANY (ARRAY['department'::text, 'department_tree'::text])
    )
);

CREATE INDEX temporary_grants_active_window_idx
  ON public.temporary_grants (user_id, ends_at)
  WHERE revoked_at IS NULL;

-- =============================================================================
-- 014 After rbac_roles: positions.default_role_id
-- =============================================================================
ALTER TABLE public.positions
  ADD COLUMN default_role_id uuid NULL
  REFERENCES public.rbac_roles (id) ON DELETE SET NULL;

-- Never reference public.roles(id) TEXT.

-- =============================================================================
-- 015 user_profiles compatibility columns (no backfill)
-- Preflight A10/A12 prove these columns / fkey name are absent.
-- =============================================================================
ALTER TABLE public.user_profiles
  ADD COLUMN primary_organization_id uuid NULL
    REFERENCES public.organizations (id) ON DELETE SET NULL,
  ADD COLUMN primary_organizational_unit_id uuid NULL,
  ADD COLUMN primary_position_id uuid NULL
    REFERENCES public.positions (id) ON DELETE SET NULL,
  ADD COLUMN rbac_v2_ready boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_primary_unit_org_fkey
  FOREIGN KEY (primary_organizational_unit_id, primary_organization_id)
  REFERENCES public.organizational_units (id, organization_id)
  ON DELETE SET NULL;

-- Do NOT drop role_id / heltes_* / alba_* / position_* text columns.

COMMIT;

-- =============================================================================
-- END DRAFT — NOT EXECUTED — NOT PRODUCTION AUTHORIZED
-- =============================================================================
