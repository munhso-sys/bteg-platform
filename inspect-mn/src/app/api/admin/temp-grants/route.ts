import { NextResponse } from "next/server";
import { requireGrantManagerContext } from "@/lib/rbac/require-admin";

export async function GET() {
  const ctx = await requireGrantManagerContext();
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const [{ data: grants, error }, { data: users }] = await Promise.all([
    admin
      .from("temporary_edit_grants")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("user_profiles").select("user_id, full_name, email, role_id, alba_name"),
  ]);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    grants: grants ?? [],
    users: users ?? [],
  });
}

type PostBody = {
  user_id?: string;
  permission_id?: string;
  ends_at?: string;
  starts_at?: string;
  reason?: string;
  heltes_id?: string;
  alba_id?: string;
  resource_type?: string;
  resource_id?: string;
};

export async function POST(req: Request) {
  const ctx = await requireGrantManagerContext();
  if ("error" in ctx) return ctx.error;
  const { user, admin } = ctx;

  const body = (await req.json()) as PostBody;
  if (!body.user_id || !body.permission_id || !body.ends_at) {
    return NextResponse.json(
      { ok: false, error: "user_id, permission_id, ends_at шаардлагатай" },
      { status: 400 },
    );
  }

  const ends = new Date(body.ends_at);
  if (Number.isNaN(ends.getTime()) || ends.getTime() <= Date.now()) {
    return NextResponse.json(
      { ok: false, error: "Дуусах хугацаа ирээдүйд байх ёстой" },
      { status: 400 },
    );
  }

  const { data, error } = await admin
    .from("temporary_edit_grants")
    .insert({
      user_id: body.user_id,
      permission_id: body.permission_id,
      starts_at: body.starts_at ?? new Date().toISOString(),
      ends_at: ends.toISOString(),
      reason: body.reason ?? null,
      heltes_id: body.heltes_id ?? null,
      alba_id: body.alba_id ?? null,
      resource_type: body.resource_type ?? "inspection",
      resource_id: body.resource_id ?? null,
      granted_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, grant: data });
}

type PatchBody = { id?: string; action?: "revoke" };

export async function PATCH(req: Request) {
  const ctx = await requireGrantManagerContext();
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as PatchBody;
  if (!body.id || body.action !== "revoke") {
    return NextResponse.json(
      { ok: false, error: "id + action=revoke шаардлагатай" },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("temporary_edit_grants")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
