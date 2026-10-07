-- =============================================================================
-- DRAFT — NOT EXECUTED — NOT PRODUCTION AUTHORIZED
-- RBAC-V2 E1 validation (preflight / postflight / executable constraint tests)
-- G1-PREP-R2: drift guards A9–A13 (migration ownership)
-- Require before forward apply: PASS A3 + A6 + A8 + A9 + A10 + A11 + A12 + A13
-- =============================================================================

-- #############################################################################
-- A. PRE-FLIGHT (BEFORE forward apply)
-- #############################################################################

SELECT 'A1_version' AS check_id, version() AS detail;

-- A2 informational only (Option A: E1 does not manage pgcrypto). UUID check = A13.
SELECT 'A2_pgcrypto_info' AS check_id,
       EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS pgcrypto_installed;

-- Expect zero collisions before E1
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'organizations', 'organizational_units', 'organizational_unit_aliases',
      'positions', 'position_aliases', 'user_org_memberships', 'user_positions',
      'rbac_roles', 'rbac_role_permissions', 'user_roles',
      'user_permission_overrides', 'temporary_grants'
    );
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL A3: % v2 table name collision(s) already exist', n;
  END IF;
  RAISE NOTICE 'PASS A3: no v2 table name collisions';
END $$;

SELECT 'A4_permissions_columns' AS check_id, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'permissions'
ORDER BY ordinal_position;

-- Baseline counts for postflight compare (session-local)
CREATE TEMP TABLE IF NOT EXISTS e1_baseline_counts (
  obj text PRIMARY KEY,
  n bigint NOT NULL
);
TRUNCATE e1_baseline_counts;
INSERT INTO e1_baseline_counts (obj, n)
SELECT 'roles', count(*)::bigint FROM public.roles
UNION ALL SELECT 'permissions', count(*)::bigint FROM public.permissions
UNION ALL SELECT 'role_permissions', count(*)::bigint FROM public.role_permissions
UNION ALL SELECT 'user_profiles', count(*)::bigint FROM public.user_profiles
UNION ALL SELECT 'access_requests', count(*)::bigint FROM public.access_requests
UNION ALL SELECT 'temporary_edit_grants', count(*)::bigint FROM public.temporary_edit_grants
UNION ALL SELECT 'app_data_store', count(*)::bigint FROM public.app_data_store;

SELECT 'A5_baseline' AS check_id, obj, n FROM e1_baseline_counts ORDER BY obj;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.permissions GROUP BY id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'FAIL A6: duplicate permission ids';
  END IF;
  RAISE NOTICE 'PASS A6: no duplicate permission ids';
END $$;

SELECT 'A7_user_id_type' AS check_id, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'user_id';

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NULL
     OR to_regclass('public.permissions') IS NULL THEN
    RAISE EXCEPTION 'FAIL A8: required FK targets missing';
  END IF;
  RAISE NOTICE 'PASS A8: user_profiles and permissions exist';
END $$;

-- A9: permissions must NOT already have E1 target columns
DO $$
DECLARE
  hit text[];
BEGIN
  SELECT array_agg(column_name::text ORDER BY column_name)
  INTO hit
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'permissions'
    AND column_name IN (
      'resource', 'action', 'scope_mode', 'status', 'is_sensitive', 'updated_at'
    );
  IF hit IS NOT NULL THEN
    RAISE EXCEPTION
      'FAIL A9: EVIDENCE_DRIFT — permissions already contains E1 target column(s): %',
      hit;
  END IF;
  RAISE NOTICE 'PASS A9: permissions has no E1 target columns';
END $$;

-- A10: user_profiles must NOT already have E1 compat columns
DO $$
DECLARE
  hit text[];
BEGIN
  SELECT array_agg(column_name::text ORDER BY column_name)
  INTO hit
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name IN (
      'primary_organization_id',
      'primary_organizational_unit_id',
      'primary_position_id',
      'rbac_v2_ready'
    );
  IF hit IS NOT NULL THEN
    RAISE EXCEPTION
      'FAIL A10: EVIDENCE_DRIFT — user_profiles already contains E1 target column(s): %',
      hit;
  END IF;
  RAISE NOTICE 'PASS A10: user_profiles has no E1 compat columns';
END $$;

-- A11: E1-owned function must NOT already exist
DO $$
BEGIN
  IF to_regprocedure('public.rbac_v2_org_unit_parent_guard()') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname = 'rbac_v2_org_unit_parent_guard'
     ) THEN
    RAISE EXCEPTION
      'FAIL A11: EVIDENCE_DRIFT — public.rbac_v2_org_unit_parent_guard() already exists';
  END IF;
  RAISE NOTICE 'PASS A11: E1 parent-guard function absent';
END $$;

-- A12: E1-owned constraint/index names on legacy tables must NOT exist
DO $$
DECLARE
  hit text[];
BEGIN
  SELECT array_agg(x ORDER BY x) INTO hit
  FROM (
    SELECT conname AS x
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
      AND conname IN (
        'permissions_status_check',
        'permissions_scope_mode_check',
        'user_profiles_primary_unit_org_fkey'
      )
    UNION
    SELECT indexname AS x
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'permissions_status_idx',
        'permissions_module_idx'
      )
  ) s;
  IF hit IS NOT NULL THEN
    RAISE EXCEPTION
      'FAIL A12: EVIDENCE_DRIFT — E1 constraint/index name(s) already exist: %',
      hit;
  END IF;
  RAISE NOTICE 'PASS A12: E1 legacy-table constraint/index names absent';
END $$;

-- A13: UUID generation prerequisite (Option A — E1 does not install pgcrypto)
DO $$
DECLARE
  u uuid;
BEGIN
  BEGIN
    u := gen_random_uuid();
  EXCEPTION
    WHEN undefined_function THEN
      RAISE EXCEPTION
        'FAIL A13: gen_random_uuid() unavailable — DBA must provide UUID capability before E1 (pgcrypto/shared prerequisite; E1 will not CREATE EXTENSION)';
  END;
  IF u IS NULL THEN
    RAISE EXCEPTION 'FAIL A13: gen_random_uuid() returned null';
  END IF;
  RAISE NOTICE 'PASS A13: gen_random_uuid() available (shared prerequisite; not E1-owned)';
END $$;

-- #############################################################################
-- B. POST-FLIGHT (AFTER forward apply; before seed)
-- #############################################################################

-- B1: 12/12 new tables exist
DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(t)
  INTO missing
  FROM unnest(ARRAY[
    'organizations', 'organizational_units', 'organizational_unit_aliases',
    'positions', 'position_aliases', 'user_org_memberships', 'user_positions',
    'rbac_roles', 'rbac_role_permissions', 'user_roles',
    'user_permission_overrides', 'temporary_grants'
  ]) AS t
  WHERE to_regclass('public.' || t) IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL B1: missing tables: %', missing;
  END IF;
  RAISE NOTICE 'PASS B1: 12/12 new tables exist';
END $$;

-- B2: required columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='permissions'
      AND column_name='status'
  ) THEN
    RAISE EXCEPTION 'FAIL B2: permissions.status missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='positions'
      AND column_name='default_role_id'
  ) THEN
    RAISE EXCEPTION 'FAIL B2: positions.default_role_id missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_profiles'
      AND column_name='rbac_v2_ready'
  ) THEN
    RAISE EXCEPTION 'FAIL B2: user_profiles.rbac_v2_ready missing';
  END IF;
  RAISE NOTICE 'PASS B2: required expanded columns exist';
END $$;

-- B3: required indexes / constraints
DO $$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(x)
  INTO missing
  FROM unnest(ARRAY[
    'organizational_units_id_org_key',
    'user_org_memberships_one_active_primary_uidx',
    'user_roles_one_active_primary_uidx',
    'user_positions_one_active_primary_uidx',
    'rbac_role_permissions_role_perm_scope_uidx',
    'temporary_grants_active_window_idx',
    'rbac_roles_legacy_code_uidx'
  ]) AS x
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = x
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace AND conname = x
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL B3: missing index/constraint: %', missing;
  END IF;
  RAISE NOTICE 'PASS B3: required indexes/constraints exist';
END $$;

-- B4: legacy counts vs baseline (same session as preflight)
DO $$
DECLARE
  r record;
  cur bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'e1_baseline_counts' AND relpersistence = 't') THEN
    RAISE EXCEPTION 'FAIL B4: e1_baseline_counts temp missing — re-run section A in this session';
  END IF;
  FOR r IN SELECT obj, n FROM e1_baseline_counts LOOP
    EXECUTE format('SELECT count(*)::bigint FROM public.%I', r.obj) INTO cur;
    IF cur <> r.n THEN
      RAISE EXCEPTION 'FAIL B4: % count changed % → %', r.obj, r.n, cur;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS B4: legacy row counts unchanged vs baseline';
END $$;

-- B5: all permission rows status=legacy (E1 pre-seed)
DO $$
DECLARE
  bad bigint;
  total bigint;
BEGIN
  SELECT count(*) INTO total FROM public.permissions;
  SELECT count(*) INTO bad FROM public.permissions WHERE status IS DISTINCT FROM 'legacy';
  IF total = 0 THEN
    RAISE EXCEPTION 'FAIL B5: permissions table empty';
  END IF;
  IF bad <> 0 THEN
    RAISE EXCEPTION 'FAIL B5: % permission rows not status=legacy', bad;
  END IF;
  RAISE NOTICE 'PASS B5: all % permission rows status=legacy', total;
END $$;

-- B6: rbac_v2_ready true count = 0; profiles not deleted
DO $$
DECLARE
  ready_true bigint;
  profiles bigint;
  baseline bigint;
BEGIN
  SELECT n INTO baseline FROM e1_baseline_counts WHERE obj = 'user_profiles';
  SELECT count(*) INTO profiles FROM public.user_profiles;
  SELECT count(*) INTO ready_true FROM public.user_profiles WHERE rbac_v2_ready IS TRUE;
  IF profiles <> baseline THEN
    RAISE EXCEPTION 'FAIL B6: user_profiles count % ≠ baseline %', profiles, baseline;
  END IF;
  IF ready_true <> 0 THEN
    RAISE EXCEPTION 'FAIL B6: rbac_v2_ready=true count=% (expected 0)', ready_true;
  END IF;
  RAISE NOTICE 'PASS B6: profiles intact; rbac_v2_ready=true count=0';
END $$;

-- B7: roles count intact
DO $$
DECLARE
  cur bigint;
  baseline bigint;
BEGIN
  SELECT n INTO baseline FROM e1_baseline_counts WHERE obj = 'roles';
  SELECT count(*) INTO cur FROM public.roles;
  IF cur <> baseline THEN
    RAISE EXCEPTION 'FAIL B7: roles count % ≠ baseline %', cur, baseline;
  END IF;
  RAISE NOTICE 'PASS B7: roles rows not deleted';
END $$;

-- B8: 12/12 E1 tables empty (pre-seed)
DO $$
DECLARE
  r record;
  cur bigint;
  bad text[] := ARRAY[]::text[];
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'organizations', 'organizational_units', 'organizational_unit_aliases',
      'positions', 'position_aliases', 'user_org_memberships', 'user_positions',
      'rbac_roles', 'rbac_role_permissions', 'user_roles',
      'user_permission_overrides', 'temporary_grants'
    ]) AS obj
  LOOP
    EXECUTE format('SELECT count(*)::bigint FROM public.%I', r.obj) INTO cur;
    IF cur <> 0 THEN
      bad := array_append(bad, r.obj || '=' || cur::text);
    END IF;
  END LOOP;
  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL B8: non-empty E1 tables before seed: %', bad;
  END IF;
  RAISE NOTICE 'PASS B8: 12/12 new tables empty (0 rows each)';
END $$;

-- Per-table emptiness detail (expect n=0 for all)
SELECT 'organizations' AS table_name, count(*)::bigint AS n FROM public.organizations
UNION ALL SELECT 'organizational_units', count(*)::bigint FROM public.organizational_units
UNION ALL SELECT 'organizational_unit_aliases', count(*)::bigint FROM public.organizational_unit_aliases
UNION ALL SELECT 'positions', count(*)::bigint FROM public.positions
UNION ALL SELECT 'position_aliases', count(*)::bigint FROM public.position_aliases
UNION ALL SELECT 'user_org_memberships', count(*)::bigint FROM public.user_org_memberships
UNION ALL SELECT 'user_positions', count(*)::bigint FROM public.user_positions
UNION ALL SELECT 'rbac_roles', count(*)::bigint FROM public.rbac_roles
UNION ALL SELECT 'rbac_role_permissions', count(*)::bigint FROM public.rbac_role_permissions
UNION ALL SELECT 'user_roles', count(*)::bigint FROM public.user_roles
UNION ALL SELECT 'user_permission_overrides', count(*)::bigint FROM public.user_permission_overrides
UNION ALL SELECT 'temporary_grants', count(*)::bigint FROM public.temporary_grants
ORDER BY 1;

-- #############################################################################
-- C+D. EXECUTABLE CONSTRAINT TESTS (disposable; leave no residue)
-- Requires ≥1 row in user_profiles and permissions (staging fixture / any profile).
-- Entire body runs in one DO subtransaction and rolls back via sentinel exception.
-- #############################################################################

DO $$
DECLARE
  v_user uuid;
  v_perm text;
  v_org_a uuid;
  v_org_b uuid;
  v_unit_a uuid;
  v_unit_b uuid;
  v_unit_child uuid;
  v_pos uuid;
  v_role uuid;
  v_ok boolean;
  v_bogus uuid := '00000000-0000-0000-0000-000000000099';
BEGIN
  SELECT user_id INTO v_user FROM public.user_profiles LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'FAIL FIXTURE: no user_profiles row — provide staging fixture user before C/D tests';
  END IF;

  SELECT id INTO v_perm FROM public.permissions LIMIT 1;
  IF v_perm IS NULL THEN
    RAISE EXCEPTION 'FAIL FIXTURE: no permissions row';
  END IF;

  INSERT INTO public.organizations (code, name)
  VALUES ('e1test-org-a', 'E1 Test Org A')
  RETURNING id INTO v_org_a;

  INSERT INTO public.organizations (code, name)
  VALUES ('e1test-org-b', 'E1 Test Org B')
  RETURNING id INTO v_org_b;

  INSERT INTO public.organizational_units (
    organization_id, parent_id, unit_type, code, name
  ) VALUES (
    v_org_a, NULL, 'heltes', 'heltes:e1-a', 'Unit A'
  ) RETURNING id INTO v_unit_a;

  INSERT INTO public.organizational_units (
    organization_id, parent_id, unit_type, code, name
  ) VALUES (
    v_org_b, NULL, 'heltes', 'heltes:e1-b', 'Unit B'
  ) RETURNING id INTO v_unit_b;

  -- -------------------------------------------------------------------------
  -- N1 invalid unit_type — expect CHECK failure
  -- -------------------------------------------------------------------------
  v_ok := false;
  BEGIN
    INSERT INTO public.organizational_units (
      organization_id, parent_id, unit_type, name
    ) VALUES (v_org_a, NULL, 'invalid_type', 'bad');
  EXCEPTION
    WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL N1: invalid unit_type was accepted';
  END IF;
  RAISE NOTICE 'PASS N1: invalid unit_type rejected';

  -- -------------------------------------------------------------------------
  -- N2 duplicate active primary membership — expect unique violation
  -- -------------------------------------------------------------------------
  INSERT INTO public.user_org_memberships (
    user_id, organization_id, organizational_unit_id,
    membership_kind, is_primary, status, effective_from
  ) VALUES (
    v_user, v_org_a, v_unit_a, 'primary', true, 'active', now()
  );

  v_ok := false;
  BEGIN
    INSERT INTO public.user_org_memberships (
      user_id, organization_id, organizational_unit_id,
      membership_kind, is_primary, status, effective_from
    ) VALUES (
      v_user, v_org_a, v_unit_a, 'primary', true, 'active', now()
    );
  EXCEPTION
    WHEN unique_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL N2: duplicate active primary membership accepted';
  END IF;
  RAISE NOTICE 'PASS N2: duplicate active primary rejected';

  -- -------------------------------------------------------------------------
  -- N3 Position Org A → Unit B — expect FK failure
  -- -------------------------------------------------------------------------
  v_ok := false;
  BEGIN
    INSERT INTO public.positions (
      organization_id, organizational_unit_id, title
    ) VALUES (v_org_a, v_unit_b, 'cross-org position');
  EXCEPTION
    WHEN foreign_key_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL N3: cross-org position accepted';
  END IF;
  RAISE NOTICE 'PASS N3: Position Org A → Unit B rejected';

  -- -------------------------------------------------------------------------
  -- N4 Membership Org A → Unit B — expect FK failure
  -- -------------------------------------------------------------------------
  v_ok := false;
  BEGIN
    INSERT INTO public.user_org_memberships (
      user_id, organization_id, organizational_unit_id,
      membership_kind, is_primary, status, effective_from
    ) VALUES (
      v_user, v_org_a, v_unit_b, 'secondary', false, 'active', now()
    );
  EXCEPTION
    WHEN foreign_key_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL N4: cross-org membership accepted';
  END IF;
  RAISE NOTICE 'PASS N4: Membership Org A → Unit B rejected';

  -- -------------------------------------------------------------------------
  -- N5 scope_type = none — expect CHECK failure
  -- -------------------------------------------------------------------------
  INSERT INTO public.rbac_roles (code, label, kind)
  VALUES ('e1test.role', 'E1 Test Role', 'custom')
  RETURNING id INTO v_role;

  v_ok := false;
  BEGIN
    INSERT INTO public.rbac_role_permissions (
      role_id, permission_id, scope_type, scope_ref
    ) VALUES (v_role, v_perm, 'none', NULL);
  EXCEPTION
    WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL N5: scope_type=none accepted';
  END IF;
  RAISE NOTICE 'PASS N5: scope_type=none rejected';

  -- -------------------------------------------------------------------------
  -- N6 scope_ref with scope_type=own — expect CHECK failure
  -- -------------------------------------------------------------------------
  v_ok := false;
  BEGIN
    INSERT INTO public.rbac_role_permissions (
      role_id, permission_id, scope_type, scope_ref
    ) VALUES (v_role, v_perm, 'own', v_unit_a);
  EXCEPTION
    WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL N6: scope_ref with scope_type=own accepted';
  END IF;
  RAISE NOTICE 'PASS N6: scope_ref + own rejected';

  -- -------------------------------------------------------------------------
  -- N7 invalid effective window — expect CHECK failure
  -- -------------------------------------------------------------------------
  v_ok := false;
  BEGIN
    INSERT INTO public.user_org_memberships (
      user_id, organization_id, organizational_unit_id,
      membership_kind, is_primary, status,
      effective_from, effective_to
    ) VALUES (
      v_user, v_org_a, v_unit_a, 'secondary', false, 'ended',
      now(), now() - interval '1 hour'
    );
  EXCEPTION
    WHEN check_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL N7: invalid effective window accepted';
  END IF;
  RAISE NOTICE 'PASS N7: invalid effective window rejected';

  -- -------------------------------------------------------------------------
  -- N8 invalid positions.default_role_id — expect FK failure
  -- -------------------------------------------------------------------------
  INSERT INTO public.positions (
    organization_id, organizational_unit_id, title
  ) VALUES (v_org_a, v_unit_a, 'E1 Pos')
  RETURNING id INTO v_pos;

  v_ok := false;
  BEGIN
    UPDATE public.positions
    SET default_role_id = v_bogus
    WHERE id = v_pos;
  EXCEPTION
    WHEN foreign_key_violation THEN v_ok := true;
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'FAIL N8: invalid default_role_id accepted';
  END IF;
  RAISE NOTICE 'PASS N8: invalid default_role_id rejected';

  -- =========================================================================
  -- POSITIVE CONTROLS (same rolled-back transaction)
  -- =========================================================================

  INSERT INTO public.organizational_units (
    organization_id, parent_id, unit_type, code, name
  ) VALUES (
    v_org_a, v_unit_a, 'alba', 'alba:e1-child', 'Child Alba'
  ) RETURNING id INTO v_unit_child;

  INSERT INTO public.organizational_unit_aliases (
    organizational_unit_id, source, external_id
  ) VALUES (v_unit_a, 'portal_heltes_slug', 'heltes:e1-a-alias');

  INSERT INTO public.position_aliases (
    position_id, source, external_id
  ) VALUES (v_pos, 'portal_profile', 'e1-pos-alias');

  UPDATE public.positions
  SET default_role_id = v_role
  WHERE id = v_pos;

  IF NOT EXISTS (
    SELECT 1 FROM public.positions WHERE id = v_pos AND default_role_id = v_role
  ) THEN
    RAISE EXCEPTION 'FAIL P: default_role_id → rbac_roles failed';
  END IF;
  RAISE NOTICE 'PASS P: positions.default_role_id → rbac_roles';

  INSERT INTO public.rbac_role_permissions (
    role_id, permission_id, scope_type, scope_ref
  ) VALUES (v_role, v_perm, 'department', NULL);

  INSERT INTO public.user_roles (
    user_id, role_id, is_primary, source, status, effective_from
  ) VALUES (
    v_user, v_role, true, 'manual', 'active', now()
  );

  INSERT INTO public.user_positions (
    user_id, position_id, is_primary, status, effective_from
  ) VALUES (
    v_user, v_pos, true, 'active', now()
  );

  INSERT INTO public.user_permission_overrides (
    user_id, permission_id, effect, scope_type, scope_ref,
    reason, status, effective_from
  ) VALUES (
    v_user, v_perm, 'deny', NULL, NULL,
    'e1 validation disposable deny', 'active', now()
  );

  INSERT INTO public.temporary_grants (
    user_id, permission_id, scope_type, scope_ref,
    starts_at, ends_at, reason
  ) VALUES (
    v_user, v_perm, 'assigned', NULL,
    now(), now() + interval '1 hour', 'e1 validation temp'
  );

  RAISE NOTICE 'PASS P: org/unit/alias/position/membership/role/rp/user_role/override/temp_grant';

  -- Force rollback of all fixture rows in this DO subtransaction
  RAISE EXCEPTION 'rbac_v2_e1_validation_tx_rollback';
EXCEPTION
  WHEN raise_exception THEN
    IF SQLERRM = 'rbac_v2_e1_validation_tx_rollback' THEN
      RAISE NOTICE 'PASS C/D: all negative+positive tests; disposable rows rolled back';
    ELSE
      RAISE;
    END IF;
END $$;

-- Residue check after C/D (must remain 12/12 empty)
DO $$
DECLARE
  r record;
  cur bigint;
  bad text[] := ARRAY[]::text[];
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'organizations', 'organizational_units', 'organizational_unit_aliases',
      'positions', 'position_aliases', 'user_org_memberships', 'user_positions',
      'rbac_roles', 'rbac_role_permissions', 'user_roles',
      'user_permission_overrides', 'temporary_grants'
    ]) AS obj
  LOOP
    EXECUTE format('SELECT count(*)::bigint FROM public.%I', r.obj) INTO cur;
    IF cur <> 0 THEN
      bad := array_append(bad, r.obj || '=' || cur::text);
    END IF;
  END LOOP;
  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL RESIDUE: test data remained: %', bad;
  END IF;
  RAISE NOTICE 'PASS RESIDUE: zero rows in all 12 E1 tables after tests';
END $$;

-- #############################################################################
-- F. POST-ROLLBACK REHEARSAL CHECKS (run AFTER rbac_v2_e1_rollback_DRAFT.sql)
-- Prefer same session that still has e1_baseline_counts from section A.
-- #############################################################################

DO $$
DECLARE
  n int;
  hit text[];
BEGIN
  -- F1: E1 target tables absent
  SELECT count(*) INTO n
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'organizations', 'organizational_units', 'organizational_unit_aliases',
      'positions', 'position_aliases', 'user_org_memberships', 'user_positions',
      'rbac_roles', 'rbac_role_permissions', 'user_roles',
      'user_permission_overrides', 'temporary_grants'
    );
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL F1: % E1 table(s) still present after rollback', n;
  END IF;
  RAISE NOTICE 'PASS F1: E1 target tables absent';

  -- F2: E1 permissions columns absent
  SELECT array_agg(column_name::text ORDER BY column_name) INTO hit
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'permissions'
    AND column_name IN (
      'resource', 'action', 'scope_mode', 'status', 'is_sensitive', 'updated_at'
    );
  IF hit IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL F2: permissions still has E1 columns after rollback: %', hit;
  END IF;
  RAISE NOTICE 'PASS F2: E1 permissions columns absent';

  -- F3: E1 profile compat columns absent
  SELECT array_agg(column_name::text ORDER BY column_name) INTO hit
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name IN (
      'primary_organization_id',
      'primary_organizational_unit_id',
      'primary_position_id',
      'rbac_v2_ready'
    );
  IF hit IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL F3: user_profiles still has E1 columns after rollback: %', hit;
  END IF;
  RAISE NOTICE 'PASS F3: E1 profile compat columns absent';

  -- F4: E1 function absent
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rbac_v2_org_unit_parent_guard'
  ) THEN
    RAISE EXCEPTION 'FAIL F4: rbac_v2_org_unit_parent_guard still exists after rollback';
  END IF;
  RAISE NOTICE 'PASS F4: E1 function absent';

  -- F5: legacy tables still exist
  IF to_regclass('public.roles') IS NULL
     OR to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('public.user_profiles') IS NULL THEN
    RAISE EXCEPTION 'FAIL F5: legacy core table missing after rollback';
  END IF;
  RAISE NOTICE 'PASS F5: legacy roles/permissions/role_permissions/user_profiles exist';

  -- F6: original legacy columns still present
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='permissions'
      AND column_name IN ('id', 'label', 'module', 'description')
  ) <> 4 THEN
    RAISE EXCEPTION 'FAIL F6: permissions lost original columns';
  END IF;
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_profiles'
      AND column_name IN (
        'role_id', 'heltes_id', 'heltes_name', 'alba_id', 'alba_name',
        'position_id', 'position_name'
      )
  ) <> 7 THEN
    RAISE EXCEPTION 'FAIL F6: user_profiles lost original org/role columns';
  END IF;
  RAISE NOTICE 'PASS F6: original legacy columns intact';
END $$;

-- F7: legacy row counts equal preflight baseline (same session)
DO $$
DECLARE
  r record;
  cur bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'e1_baseline_counts' AND relpersistence = 't'
  ) THEN
    RAISE EXCEPTION 'FAIL F7: e1_baseline_counts missing — keep session from preflight A or reload saved baseline';
  END IF;
  FOR r IN SELECT obj, n FROM e1_baseline_counts LOOP
    EXECUTE format('SELECT count(*)::bigint FROM public.%I', r.obj) INTO cur;
    IF cur <> r.n THEN
      RAISE EXCEPTION 'FAIL F7: % count % ≠ baseline % after rollback', r.obj, cur, r.n;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS F7: legacy row counts equal preflight baseline after rollback';
END $$;

-- #############################################################################
-- E. LIFECYCLE RULE (documentation as SQL comments — C5)
-- #############################################################################
-- Partial unique indexes use (status='active' AND is_primary) and CANNOT use
-- now()-based predicates. Therefore:
--   Future-dated primary memberships / user_positions / user_roles MUST NOT be
--   inserted with status='active' before activation/cutover time.
-- Preferred E1 operational rule: insert/activate at effective time (keep enum).
-- Do not mark pre-effective rows as active.

-- =============================================================================
-- END DRAFT — NOT EXECUTED — NOT PRODUCTION AUTHORIZED
-- =============================================================================
