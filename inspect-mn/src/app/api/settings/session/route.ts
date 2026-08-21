import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { userCanManageSettings } from "@/lib/rbac/require-settings";
import type { RoleId, UserProfile } from "@/lib/rbac/types";
import {
  DEFAULT_SESSION_SETTINGS,
  SESSION_SETTINGS_KEY,
  normalizeSessionSettings,
  type SessionSettings,
} from "@/lib/session-settings";

async function readSettings(): Promise<SessionSettings> {
  if (!hasServiceRole()) return DEFAULT_SESSION_SETTINGS;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_data_store")
    .select("payload")
    .eq("key", SESSION_SETTINGS_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[session-settings] load failed", error.message);
    return DEFAULT_SESSION_SETTINGS;
  }
  if (!data?.payload) return DEFAULT_SESSION_SETTINGS;
  return normalizeSessionSettings(data.payload);
}

async function writeSettings(settings: SessionSettings) {
  if (!hasServiceRole()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("app_data_store").upsert(
    {
      key: SESSION_SETTINGS_KEY,
      payload: settings,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 });
  }

  const settings = await readSettings();
  return NextResponse.json({ ok: true, settings });
}

type PatchBody = {
  idleLogoutMinutes?: number;
};

async function requireSessionSettingsEditor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 }),
    };
  }

  if (!hasServiceRole()) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error: "SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна",
        },
        { status: 500 },
      ),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = profile as Pick<UserProfile, "role_id" | "status"> | null;
  if (!p || p.status !== "active") {
    return {
      error: NextResponse.json(
        { ok: false, error: "Хандах эрх хүрэлцэхгүй" },
        { status: 403 },
      ),
    };
  }

  const ok = await userCanManageSettings(user.id, p.role_id as RoleId | null);
  if (!ok) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Хандах эрх хүрэлцэхгүй" },
        { status: 403 },
      ),
    };
  }

  return { user };
}

export async function PATCH(req: Request) {
  const ctx = await requireSessionSettingsEditor();
  if ("error" in ctx) return ctx.error;

  const body = (await req.json()) as PatchBody;
  const settings = normalizeSessionSettings({
    idleLogoutMinutes: body.idleLogoutMinutes,
  });

  try {
    await writeSettings(settings);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Хадгалахад алдаа",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, settings });
}
