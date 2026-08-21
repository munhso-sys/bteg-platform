import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RoleId, UserProfile } from "@/lib/rbac/types";
import { NextResponse } from "next/server";

const ADMIN_ROLES: RoleId[] = ["admin"];
const GRANT_ROLES: RoleId[] = ["admin", "dxsh_head", "dxsh_specialist"];

async function requireRoleContext(allowed: RoleId[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 }),
    };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "Admin client missing",
        },
        { status: 500 },
      ),
    };
  }

  const { data: profile } = await admin
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const p = profile as UserProfile | null;

  if ((!p || p.status !== "active" || !p.role_id || !allowed.includes(p.role_id)) &&
    allowed.includes("admin")) {
    const { count } = await admin
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("role_id", "admin")
      .eq("status", "active");

    if ((count ?? 0) === 0 && allowed.includes("admin")) {
      const bootstrapped: UserProfile = {
        user_id: user.id,
        email: user.email ?? "",
        full_name: (user.user_metadata?.full_name as string) ?? user.email ?? "Admin",
        phone: null,
        heltes_id: null,
        heltes_name: null,
        alba_id: null,
        alba_name: null,
        position_id: null,
        position_name: null,
        role_id: "admin",
        status: "active",
      };
      await admin.from("user_profiles").upsert({
        ...bootstrapped,
        updated_at: new Date().toISOString(),
      });
      return { user, admin, profile: bootstrapped };
    }
  }

  if (!p || p.status !== "active" || !p.role_id || !allowed.includes(p.role_id)) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Хандах эрх хүрэлцэхгүй" },
        { status: 403 },
      ),
    };
  }

  return { user, admin, profile: p };
}

export async function requireAdminContext() {
  return requireRoleContext(ADMIN_ROLES);
}

export async function requireGrantManagerContext() {
  return requireRoleContext(GRANT_ROLES);
}
