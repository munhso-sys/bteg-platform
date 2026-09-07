/**
 * P0-03: failing-before vs passing-after tenant isolation for JSON stores.
 *
 * Failing-before (legacy mega-key): one app_data_store row can hold A+B payloads;
 * any holder of that row sees both tenants.
 *
 * Passing-after (org_app_data_store): B authenticated user cannot SELECT A's row.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase admin client typing for local RLS probes */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { describe, it } from "node:test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const configured = Boolean(url && anon && service);

const LEGACY_KEY = "p0_03_legacy_mega_probe";
const DOC_KEY = "inspection_center_store";

async function ensureUser(
  admin: any,
  email: string,
  password: string,
  heltesId: string,
) {
  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  let user = listed.data.users.find((u: { email?: string | null }) => u.email === email);

  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw created.error;
    user = created.data.user;
  }
  await (admin as any).from("roles").upsert({ id: "inspector", label: "Inspector", sort_order: 2 });
  const { error } = await (admin as any).from("user_profiles").upsert({
    user_id: user.id,
    email,
    full_name: email,
    heltes_id: heltesId,
    role_id: "inspector",
    status: "active",
  });
  if (error) throw error;
  return user;
}

describe("P0-03 tenant isolation", { skip: !configured }, () => {
  it("FAILING-BEFORE evidence: legacy mega-key holds both orgs in one payload", async () => {
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const mega = {
      runs: [
        { id: "run-a", organizationId: "org-a", title: "A only" },
        { id: "run-b", organizationId: "org-b", title: "B only" },
      ],
    };
    const { error } = await admin.from("app_data_store").upsert({
      key: LEGACY_KEY,
      payload: mega,
    });
    assert.equal(error, null, error?.message);
    const { data } = await admin
      .from("app_data_store")
      .select("payload")
      .eq("key", LEGACY_KEY)
      .single();
    const runs = (data?.payload as { runs: { organizationId: string }[] })?.runs ?? [];
    const orgs = new Set(runs.map((r) => r.organizationId));
    assert.ok(orgs.has("org-a") && orgs.has("org-b"), "legacy mega-row contains both tenants");
  });

  it("PASSING-AFTER: org_app_data_store RLS hides other org documents", async () => {
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await ensureUser(admin, "p003-a@example.com", "Passw0rd!p003a", "org-a");
    await ensureUser(admin, "p003-b@example.com", "Passw0rd!p003b", "org-b");

    await admin.from("org_app_data_store").delete().eq("key", DOC_KEY);
    const upA = await admin.from("org_app_data_store").upsert({
      organization_id: "org-a",
      key: DOC_KEY,
      payload: { runs: [{ id: "run-a", title: "secret-A" }] },
    });
    assert.equal(upA.error, null, upA.error?.message);
    const upB = await admin.from("org_app_data_store").upsert({
      organization_id: "org-b",
      key: DOC_KEY,
      payload: { runs: [{ id: "run-b", title: "secret-B" }] },
    });
    assert.equal(upB.error, null, upB.error?.message);

    const clientB = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signB = await clientB.auth.signInWithPassword({
      email: "p003-b@example.com",
      password: "Passw0rd!p003b",
    });
    assert.equal(signB.error, null);

    const list = await clientB.from("org_app_data_store").select("organization_id, payload");
    assert.equal(list.error, null, list.error?.message);
    assert.equal((list.data ?? []).length, 1);
    assert.equal(list.data![0]!.organization_id, "org-b");
    const payload = list.data![0]!.payload as { runs: { title: string }[] };
    assert.equal(payload.runs[0]?.title, "secret-B");

    const directA = await clientB
      .from("org_app_data_store")
      .select("*")
      .eq("organization_id", "org-a")
      .eq("key", DOC_KEY);
    assert.equal((directA.data ?? []).length, 0);

    const forged = await clientB.from("org_app_data_store").insert({
      organization_id: "org-a",
      key: "forged",
      payload: { hack: true },
    });
    assert.ok(forged.error, "forged organization_id insert must fail");

    const crossUpdate = await clientB
      .from("org_app_data_store")
      .update({ payload: { runs: [{ title: "hijacked" }] } })
      .eq("organization_id", "org-a")
      .eq("key", DOC_KEY)
      .select("*");
    assert.equal((crossUpdate.data ?? []).length, 0);

    // B cannot reassign A's row to B (organization_id immutable via WITH CHECK).
    const steal = await clientB
      .from("org_app_data_store")
      .update({ organization_id: "org-b", payload: { stolen: true } })
      .eq("organization_id", "org-a")
      .eq("key", DOC_KEY)
      .select("*");
    assert.equal((steal.data ?? []).length, 0);

    // Null / empty organization_id insert denied by CHECK + RLS.
    const nullOrg = await clientB.from("org_app_data_store").insert({
      organization_id: "",
      key: "null-probe",
      payload: {},
    });
    assert.ok(nullOrg.error, "empty organization_id must fail");

    // Anon denied entirely.
    const anonClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonList = await anonClient.from("org_app_data_store").select("*");
    assert.ok(
      anonList.error || (anonList.data ?? []).length === 0,
      "anon must not see tenant documents",
    );
  });
});
