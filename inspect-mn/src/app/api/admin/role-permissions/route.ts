import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminContext } from "@/lib/rbac/require-admin";

/** Always granted to every role — linked policy clauses view. */
export const BASE_PERMISSION_ID = "module.policy.view";

type PermissionSeed = {
  id: string;
  label: string;
  module: string;
  description: string;
  /** Backfill: copy this permission to roles that already have `sourcePermId`. */
  backfillFrom?: string;
};

const SEED_PERMISSIONS: PermissionSeed[] = [
  {
    id: "module.process.view",
    label: "Процесс харах",
    module: "process",
    description:
      "PFD процессын зураг, зангилаа, аналитик (журам, шалгалт, зөрчил, эрсдэл) харах",
    backfillFrom: "module.inspection.view",
  },
  {
    id: "module.process.edit",
    label: "Процесс засварлах",
    module: "process",
    description: "Процессын зангилаа үүсгэх, засварлах, холбоос удирдах",
    backfillFrom: "module.inspection.edit",
  },
  {
    id: "module.smartmine.view",
    label: "SmartMine харах",
    module: "smartmine",
    description:
      "SmartMine dashboard, боловсруулалт, тоног төхөөрөмж, засварын мэдээлэл харах",
    backfillFrom: "module.results.view",
  },
  {
    id: "module.guidance.view",
    label: "Удирдамж харах",
    module: "guidance",
    description:
      "Удирдамжийн жагсаалт, дэлгэрүүлэлт, хүсэлт, хугацаа, төлөв харах",
    backfillFrom: "module.development.view",
  },
  {
    id: "module.guidance.edit",
    label: "Удирдамж засварлах",
    module: "guidance",
    description:
      "Удирдамж нэмэх, засварлах, төлөв солих, хүсэлт бүртгэх",
    backfillFrom: "module.development.edit",
  },
  {
    id: "module.voice.view",
    label: "Дуу хоолой харах",
    module: "voice",
    description:
      "Ажилтны санал, хүсэлт, гомдол, асуулга, хариу арга хэмжээ харах",
    backfillFrom: "module.results.view",
  },
  {
    id: "module.voice.edit",
    label: "Дуу хоолой засварлах",
    module: "voice",
    description:
      "Хүсэлт, гомдол хариулах, төлөв солих, мэдэгдэл илгээх",
  },
  {
    id: "module.ai.view",
    label: "AI туслах харах",
    module: "ai",
    description:
      "AI туслахыг нээж, асуулт асуух, хариулт авах",
    backfillFrom: "module.tools.view",
  },
  {
    id: "module.review.view",
    label: "Баримт харьцуулалт харах",
    module: "review",
    description:
      "Журам, заалтын ялгаа, зөрчил, дутуу болон давхардлыг эшлэлтэй шалгах",
    backfillFrom: "module.tools.view",
  },
  {
    id: "module.glossary.view",
    label: "Толь бичиг харах",
    module: "glossary",
    description: "Нэр томъёоны англи, монгол нэршил болон тайлбар харах",
    backfillFrom: "module.tools.view",
  },
  {
    id: "module.glossary.edit",
    label: "Толь бичиг засварлах",
    module: "glossary",
    description: "Нэр томъёо болон толь бичгийн үндсэн мэдээлэл нэмэх, засварлах",
  },
];

async function ensurePermissions(admin: SupabaseClient) {
  for (const perm of SEED_PERMISSIONS) {
    const { data: existing, error: lookupErr } = await admin
      .from("permissions")
      .select("id")
      .eq("id", perm.id)
      .maybeSingle();
    if (lookupErr) return lookupErr.message;

    if (!existing) {
      const { error: insErr } = await admin.from("permissions").insert({
        id: perm.id,
        label: perm.label,
        module: perm.module,
        description: perm.description,
      });
      if (insErr) return insErr.message;
    }

    if (perm.backfillFrom) {
      const { data: sourceRoles, error: srcErr } = await admin
        .from("role_permissions")
        .select("role_id")
        .eq("permission_id", perm.backfillFrom);
      if (srcErr) return srcErr.message;

      const rows = [
        ...new Set((sourceRoles ?? []).map((r) => r.role_id)),
      ].map((roleId) => ({
        role_id: roleId,
        permission_id: perm.id,
      }));
      if (rows.length > 0) {
        const { error: upErr } = await admin
          .from("role_permissions")
          .upsert(rows, { onConflict: "role_id,permission_id" });
        if (upErr) return upErr.message;
      }
    }
  }
  return null;
}

export async function GET() {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const bootstrapError = await ensurePermissions(admin);
  if (bootstrapError) {
    return NextResponse.json({ ok: false, error: bootstrapError }, { status: 500 });
  }

  const [
    { data: roles, error: rErr },
    { data: permissions, error: pErr },
    { data: matrix, error: mErr },
  ] = await Promise.all([
    admin.from("roles").select("id, label, description, sort_order").order("sort_order"),
    admin.from("permissions").select("id, label, module, description").order("module").order("id"),
    admin.from("role_permissions").select("role_id, permission_id"),
  ]);

  if (rErr || pErr || mErr) {
    return NextResponse.json(
      { ok: false, error: rErr?.message || pErr?.message || mErr?.message },
      { status: 500 },
    );
  }

  const byRole: Record<string, string[]> = {};
  for (const row of matrix ?? []) {
    const list = byRole[row.role_id] ?? [];
    list.push(row.permission_id);
    byRole[row.role_id] = list;
  }

  return NextResponse.json({
    ok: true,
    base_permission_id: BASE_PERMISSION_ID,
    roles: roles ?? [],
    permissions: permissions ?? [],
    matrix: byRole,
  });
}

type PutBody = {
  role_id?: string;
  permission_ids?: string[];
};

export async function PUT(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const { admin } = ctx;

  const bootstrapError = await ensurePermissions(admin);
  if (bootstrapError) {
    return NextResponse.json({ ok: false, error: bootstrapError }, { status: 500 });
  }

  const body = (await req.json()) as PutBody;
  const roleId = body.role_id?.trim();
  const permissionIds = Array.isArray(body.permission_ids)
    ? body.permission_ids.filter((id): id is string => typeof id === "string")
    : null;

  if (!roleId || !permissionIds) {
    return NextResponse.json(
      { ok: false, error: "role_id, permission_ids шаардлагатай" },
      { status: 400 },
    );
  }

  const { data: role } = await admin.from("roles").select("id").eq("id", roleId).maybeSingle();
  if (!role) {
    return NextResponse.json({ ok: false, error: "Role олдсонгүй" }, { status: 404 });
  }

  const { data: allPerms } = await admin.from("permissions").select("id");
  const valid = new Set((allPerms ?? []).map((p) => p.id as string));
  const next = new Set<string>(permissionIds.filter((id) => valid.has(id)));
  // Base policy view is always on
  next.add(BASE_PERMISSION_ID);

  const { error: delErr } = await admin
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);
  if (delErr) {
    return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
  }

  const rows = Array.from(next).map((permission_id) => ({
    role_id: roleId,
    permission_id,
  }));

  if (rows.length > 0) {
    const { error: insErr } = await admin.from("role_permissions").insert(rows);
    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    role_id: roleId,
    permission_ids: Array.from(next).sort(),
  });
}
