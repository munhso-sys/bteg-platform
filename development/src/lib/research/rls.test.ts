import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { describe, it } from "node:test";

/**
 * Local Supabase RLS regression for research_projects.
 * Requires: supabase start + migrations applied + env:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const configured = Boolean(url && anon && service);

async function ensureUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  password: string,
  heltesId: string,
  roleId: string,
) {
  const listed = await admin.auth.admin.listUsers({ perPage: 200 });
  let user = listed.data.users.find((u) => u.email === email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error || new Error("createUser failed");
    }
    user = created.data.user;
  }
  const { error } = await (admin as { from: (t: string) => { upsert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> } }).from("user_profiles").upsert({
    user_id: user.id,
    email,
    full_name: email,
    heltes_id: heltesId,
    role_id: roleId,
    status: "active",
  });
  if (error) throw error;
  return user;
}

describe("Research RLS (local Supabase)", { skip: !configured }, () => {
  it("own org select allowed; other org denied; anon denied; forged org insert denied", async () => {
    const admin = createClient(url, service, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await admin.from("roles").upsert([
      { id: "admin", label: "Admin", sort_order: 1 },
      { id: "inspector", label: "Inspector", sort_order: 2 },
      { id: "manager", label: "Manager", sort_order: 3 },
    ]);

    const userA = await ensureUser(
      admin,
      "rd-a@example.com",
      "Passw0rd!rd-a",
      "org-a",
      "inspector",
    );
    const userB = await ensureUser(
      admin,
      "rd-b@example.com",
      "Passw0rd!rd-b",
      "org-b",
      "manager",
    );

    await admin.from("research_projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const clientA = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signA = await clientA.auth.signInWithPassword({
      email: "rd-a@example.com",
      password: "Passw0rd!rd-a",
    });
    assert.equal(signA.error, null);

    const insertA = await clientA
      .from("research_projects")
      .insert({
        organization_id: "org-a",
        created_by: userA.id,
        title: "Org A project",
      })
      .select("*")
      .single();
    assert.equal(insertA.error, null, insertA.error?.message);
    assert.ok(insertA.data?.id);

    const forged = await clientA
      .from("research_projects")
      .insert({
        organization_id: "org-b",
        created_by: userA.id,
        title: "Forged org",
      })
      .select("*")
      .single();
    assert.ok(forged.error, "forged organization_id must fail");

    const listA = await clientA.from("research_projects").select("id, title");
    assert.equal(listA.error, null);
    assert.equal((listA.data ?? []).length, 1);

    const clientB = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await clientB.auth.signInWithPassword({
      email: "rd-b@example.com",
      password: "Passw0rd!rd-b",
    });
    const listB = await clientB.from("research_projects").select("id, title");
    assert.equal(listB.error, null);
    assert.equal((listB.data ?? []).length, 0);

    const updateCross = await clientB
      .from("research_projects")
      .update({ title: "hijack" })
      .eq("id", insertA.data!.id)
      .select("*");
    assert.equal((updateCross.data ?? []).length, 0);

    const anonClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const anonList = await anonClient.from("research_projects").select("id");
    assert.equal((anonList.data ?? []).length, 0);

    void userB;
  });
});
