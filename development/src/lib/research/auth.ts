import type { SupabaseClient, User } from "@supabase/supabase-js";

export type ResearchAuthContext = {
  user: User;
  organizationId: string;
  roleId: string | null;
};

export async function requireResearchAuth(
  supabase: SupabaseClient,
): Promise<
  | { ok: true; ctx: ResearchAuthContext }
  | { ok: false; status: 401 | 403; error: string }
> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("heltes_id, role_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      status: 403,
      error: "Organization context unavailable",
    };
  }

  if (!profile || profile.status !== "active") {
    return {
      ok: false,
      status: 403,
      error: "Active profile required",
    };
  }

  const organizationId = String(profile.heltes_id ?? "").trim();
  if (!organizationId) {
    return {
      ok: false,
      status: 403,
      error: "Organization membership required",
    };
  }

  return {
    ok: true,
    ctx: {
      user,
      organizationId,
      roleId: profile.role_id ?? null,
    },
  };
}

export function mutationOk(count: number | null | undefined) {
  return typeof count === "number" && count > 0;
}
