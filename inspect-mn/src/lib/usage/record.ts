import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendUsageEvent } from "@/lib/usage/local-store";
import type { UsageEventKind } from "@/lib/usage/types";

type ProfileSlice = {
  user_id?: string | null;
  email?: string | null;
  full_name?: string | null;
  heltes_id?: string | null;
  heltes_name?: string | null;
  alba_id?: string | null;
  alba_name?: string | null;
  position_id?: string | null;
  position_name?: string | null;
  role_id?: string | null;
};

async function loadProfileForUser(userId: string): Promise<ProfileSlice | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_profiles")
      .select(
        "user_id,email,full_name,heltes_id,heltes_name,alba_id,alba_name,position_id,position_name,role_id",
      )
      .eq("user_id", userId)
      .maybeSingle();
    return (data as ProfileSlice | null) ?? null;
  } catch {
    // No service role locally — still record anonymous-ish event with auth email.
    return null;
  }
}

export async function recordUsageEvent(input: {
  kind: UsageEventKind;
  module?: string | null;
  path?: string | null;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  detail?: string | null;
  userId?: string | null;
  email?: string | null;
}) {
  try {
    let userId = input.userId ?? null;
    let email = input.email ?? null;
    let profile: ProfileSlice | null = null;

    if (!userId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
      email = email ?? user?.email ?? null;
    }

    if (userId) {
      profile = await loadProfileForUser(userId);
    }

    await appendUsageEvent({
      kind: input.kind,
      userId,
      email: profile?.email ?? email,
      fullName: profile?.full_name ?? null,
      heltesId: profile?.heltes_id ?? null,
      heltesName: profile?.heltes_name ?? null,
      albaId: profile?.alba_id ?? null,
      albaName: profile?.alba_name ?? null,
      positionId: profile?.position_id ?? null,
      positionName: profile?.position_name ?? null,
      roleId: profile?.role_id ?? null,
      module: input.module ?? null,
      path: input.path ?? null,
      model: input.model ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      totalTokens: input.totalTokens ?? null,
      detail: input.detail ?? null,
    });
  } catch (error) {
    console.warn("[usage] record failed", error);
  }
}
