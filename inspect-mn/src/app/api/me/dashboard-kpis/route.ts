import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { getDutyModuleApps } from "@/lib/module-apps";
import type { PermissionId, RoleId, UserProfile } from "@/lib/rbac/types";

type PositionOverview = {
  ok: boolean;
  position?: { id: string; name: string; bteg_id?: string | null };
  avgScore?: number | null;
  evaluationCount?: number;
  latestEvaluationCount?: number;
  overdue?: number;
  counts?: {
    clauses: number;
    policies: number;
    implementation: number;
    monitoring: number;
    verification: number;
    deployment: number;
  };
  hasJobDescription?: boolean;
  trend?: Array<{ at: string; score: number }>;
  error?: string;
};

async function loadPermissions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  roleId: RoleId | null,
) {
  const perms = new Set<PermissionId>();
  if (roleId) {
    const { data: rolePerms } = await db
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);
    for (const row of rolePerms ?? []) {
      perms.add(row.permission_id as PermissionId);
    }
  }
  return perms;
}

async function fetchPositionOverview(
  positionId: string,
  positionName?: string | null,
): Promise<PositionOverview | null> {
  const origin = getDutyModuleApps()["policy-compliance"].origin;
  const url = new URL(
    `${origin}/api/positions/${encodeURIComponent(positionId)}/overview`,
  );
  if (positionName) url.searchParams.set("name", positionName);
  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as PositionOverview;
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 });
  }

  const db = hasServiceRole() ? createAdminClient() : supabase;
  const { data: profile } = await db
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = profile as UserProfile | null;
  const roleId = (p?.role_id ?? null) as RoleId | null;
  const permissions =
    p && p.status === "active"
      ? await loadPermissions(db, user.id, roleId)
      : new Set<PermissionId>();

  const canEditPolicy =
    permissions.has("module.policy.edit") ||
    permissions.has("portal.admin") ||
    roleId === "admin";

  if (!p?.position_id && !p?.position_name) {
    return NextResponse.json({
      ok: true,
      scoped: !canEditPolicy,
      positionLinked: false,
      position: null,
      kpis: [],
      message:
        "Профайл дээр ажлын байр тохируулаагүй байна. Нэвтрэх хүсэлтээр оноолгоо хийлгэнэ үү.",
    });
  }

  const overview = await fetchPositionOverview(
    p.position_id || p.position_name || "",
    p.position_name,
  );

  if (!overview?.ok || !overview.position) {
    return NextResponse.json({
      ok: true,
      scoped: !canEditPolicy,
      positionLinked: true,
      position: {
        id: p.position_id,
        name: p.position_name,
      },
      kpis: [],
      message: "Ажлын байрын KPI уншиж чадсангүй. Журмын биелэлт модулийг шалгана уу.",
    });
  }

  const c = overview.counts ?? {
    clauses: 0,
    policies: 0,
    implementation: 0,
    monitoring: 0,
    verification: 0,
    deployment: 0,
  };
  const avg =
    typeof overview.avgScore === "number" && Number.isFinite(overview.avgScore)
      ? Math.round(overview.avgScore)
      : null;

  const kpis = [
    {
      id: "avg",
      label: "Дундаж оноо",
      value: avg == null ? "—" : String(avg),
      hint: overview.latestEvaluationCount
        ? `${overview.latestEvaluationCount} сүүлийн үнэлгээ`
        : "Үнэлгээ байхгүй",
    },
    {
      id: "policies",
      label: "Холбогдсон журам",
      value: String(c.policies),
      hint: "ажлын байраар",
    },
    {
      id: "clauses",
      label: "Зүйл / заалт",
      value: String(c.clauses),
      hint: "холбогдсон",
    },
    {
      id: "implementation",
      label: "Гүйцэтгэх",
      value: String(c.implementation),
      hint: "үүрэг",
    },
    {
      id: "monitoring",
      label: "Хянах",
      value: String(c.monitoring),
      hint: "үүрэг",
    },
    {
      id: "verification",
      label: "Баталгаажуулах",
      value: String(c.verification),
      hint: "үүрэг",
    },
    {
      id: "deployment",
      label: "Нэвтрүүлэх",
      value: String(c.deployment),
      hint: "үүрэг",
    },
    {
      id: "attention",
      label: "Анхаарах",
      value: String(overview.overdue ?? 0),
      hint: "бага оноо / нийцээгүй",
    },
  ];

  return NextResponse.json({
    ok: true,
    scoped: !canEditPolicy,
    positionLinked: true,
    position: overview.position,
    hasJobDescription: overview.hasJobDescription ?? false,
    evaluationCount: overview.evaluationCount ?? 0,
    trend: overview.trend ?? [],
    kpis,
    href: "/policy-compliance",
  });
}
