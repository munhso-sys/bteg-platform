import { createAdminClient } from "@/lib/supabase/admin";
import { embedSrc, getDutyModuleApps, type DutyModuleId } from "@/lib/module-apps";
import {
  DEFAULT_SESSION_SETTINGS,
  normalizeSessionSettings,
  SESSION_SETTINGS_KEY,
  type SessionSettings,
} from "@/lib/session-settings";

export type ManagementModuleStatus = {
  id: DutyModuleId;
  label: string;
  href: string;
  origin: string;
  online: boolean;
  status?: number;
  reason?: string;
};

export type PendingAccessItem = {
  id: string;
  full_name: string | null;
  email: string;
  heltes_name: string | null;
  alba_name: string | null;
  created_at: string;
};

export type ManagementOverview = {
  generatedAt: string;
  people: {
    total: number;
    active: number;
    suspended: number;
    pending: number;
    admins: number;
    withRole: number;
  };
  access: {
    pendingCount: number;
    recentPending: PendingAccessItem[];
  };
  grants: {
    activeCount: number;
  };
  session: SessionSettings;
  supabase: {
    ok: boolean;
    projectRef: string | null;
    projectName: string;
    error?: string;
  };
  modules: ManagementModuleStatus[];
  conclusions: string[];
};

async function probeModule(
  id: DutyModuleId,
): Promise<ManagementModuleStatus> {
  const apps = getDutyModuleApps();
  const app = apps[id];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(embedSrc(app), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "text/html" },
      cache: "no-store",
    });
    clearTimeout(timer);
    const online = res.status > 0 && res.status < 500;
    return {
      id,
      label: app.label,
      href: app.href,
      origin: app.origin,
      online,
      status: res.status,
    };
  } catch {
    clearTimeout(timer);
    return {
      id,
      label: app.label,
      href: app.href,
      origin: app.origin,
      online: false,
      reason: "unreachable",
    };
  }
}

async function checkSupabaseHealth(): Promise<ManagementOverview["supabase"]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null;
  const projectRef = url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;

  if (!url || !key) {
    return {
      ok: false,
      projectRef,
      projectName: "inspect-bteg",
      error: "Missing Supabase env",
    };
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });
    return {
      ok: res.ok,
      projectRef,
      projectName: "inspect-bteg",
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      projectRef,
      projectName: "inspect-bteg",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function buildManagementOverview(
  admin: ReturnType<typeof createAdminClient>,
): Promise<ManagementOverview> {
  const now = new Date().toISOString();

  const [
    profilesRes,
    pendingCountRes,
    pendingRes,
    grantsRes,
    sessionRes,
    supabase,
    inspection,
    policy,
    development,
  ] = await Promise.all([
    admin.from("user_profiles").select("status, role_id"),
    admin
      .from("access_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("access_requests")
      .select("id, full_name, email, heltes_name, alba_name, created_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("temporary_edit_grants")
      .select("id, ends_at, revoked_at")
      .is("revoked_at", null)
      .gt("ends_at", now),
    admin
      .from("app_data_store")
      .select("payload")
      .eq("key", SESSION_SETTINGS_KEY)
      .maybeSingle(),
    checkSupabaseHealth(),
    probeModule("inspection"),
    probeModule("policy-compliance"),
    probeModule("development"),
  ]);

  const profiles = profilesRes.data ?? [];
  const people = {
    total: profiles.length,
    active: profiles.filter((p) => p.status === "active").length,
    suspended: profiles.filter((p) => p.status === "suspended").length,
    pending: profiles.filter((p) => p.status === "pending").length,
    admins: profiles.filter((p) => p.role_id === "admin").length,
    withRole: profiles.filter((p) => p.role_id).length,
  };

  const pendingCount = pendingCountRes.count ?? 0;
  const recentPending = (pendingRes.data ?? []).map((row) => ({
    id: String(row.id),
    full_name: row.full_name ?? null,
    email: String(row.email ?? ""),
    heltes_name: row.heltes_name ?? null,
    alba_name: row.alba_name ?? null,
    created_at: String(row.created_at ?? now),
  }));

  const session = sessionRes.data?.payload
    ? normalizeSessionSettings(sessionRes.data.payload)
    : DEFAULT_SESSION_SETTINGS;

  const modules = [inspection, policy, development];
  const onlineCount = modules.filter((m) => m.online).length;
  const grantsActive = grantsRes.data?.length ?? 0;

  const conclusions: string[] = [];
  if (pendingCount > 0) {
    conclusions.push(
      `${pendingCount} нэвтрэх хүсэлт хүлээгдэж байна — Тохиргоо → Нэвтрэх хүсэлт.`,
    );
  } else {
    conclusions.push("Хүлээгдэж буй нэвтрэх хүсэлт алга.");
  }
  if (people.admins === 0) {
    conclusions.push("Идэвхтэй админ хэрэглэгч бүртгэгдээгүй — нэн даруй шалгана уу.");
  } else {
    conclusions.push(`Идэвхтэй админ: ${people.admins}, нийт хэрэглэгч: ${people.total}.`);
  }
  conclusions.push(
    onlineCount === modules.length
      ? "Үүргийн 3 модуль бүгд онлайн."
      : `Үүргийн модуль: ${onlineCount}/${modules.length} онлайн.`,
  );
  if (!supabase.ok) {
    conclusions.push(`Supabase холболт сул: ${supabase.error ?? "алдаа"}.`);
  }
  if (grantsActive > 0) {
    conclusions.push(`Идэвхтэй хугацаатай засвар эрх: ${grantsActive}.`);
  }
  conclusions.push(
    session.idleLogoutMinutes > 0
      ? `Auto logout: ${session.idleLogoutMinutes} мин идэвхгүй байдлын дараа.`
      : "Auto logout унтраасан.",
  );

  return {
    generatedAt: now,
    people,
    access: {
      pendingCount,
      recentPending,
    },
    grants: { activeCount: grantsActive },
    session,
    supabase,
    modules,
    conclusions,
  };
}
