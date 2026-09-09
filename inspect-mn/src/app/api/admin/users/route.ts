import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import type { RoleId } from "@/lib/rbac/types";

export async function GET() {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const [{ data: users, error: uErr }, { data: roles }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("*")
      .order("full_name", { ascending: true }),
    admin.from("roles").select("id, label, description, sort_order").order("sort_order"),
  ]);

  if (uErr) {
    return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    users: users ?? [],
    roles: roles ?? [],
  });
}

type PatchBody = {
  user_id?: string;
  role_id?: RoleId;
  status?: "active" | "suspended" | "pending";
};

export async function PATCH(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const body = (await req.json()) as PatchBody;
  if (!body.user_id) {
    return NextResponse.json(
      { ok: false, error: "user_id шаардлагатай" },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.role_id) patch.role_id = body.role_id;
  if (body.status) patch.status = body.status;

  const { data, error } = await admin
    .from("user_profiles")
    .update(patch)
    .eq("user_id", body.user_id)
    .select("user_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Хэрэглэгчийн профайл олдсонгүй" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
