import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { UserProfile } from "@/lib/rbac/types";

const PROFILE_SELECT =
  "user_id, email, full_name, phone, heltes_id, heltes_name, alba_id, alba_name, position_id, position_name, role_id, status, telegram_id";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 });
  }

  const db = hasServiceRole() ? createAdminClient() : supabase;
  const { data, error } = await db
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let roleLabel: string | null = null;
  const roleId = (data as UserProfile | null)?.role_id ?? null;
  if (roleId) {
    const { data: roleRow } = await db
      .from("roles")
      .select("label")
      .eq("id", roleId)
      .maybeSingle();
    roleLabel = (roleRow?.label as string | undefined) ?? null;
  }

  return NextResponse.json({
    ok: true,
    profile: data
      ? {
          ...data,
          role_label: roleLabel,
        }
      : null,
  });
}

type PatchBody = {
  telegram_id?: string | null;
  phone?: string | null;
};

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 });
  }

  const body = (await req.json()) as PatchBody;
  const setPhone = "phone" in body;
  const setTelegram = "telegram_id" in body;
  if (!setPhone && !setTelegram) {
    return NextResponse.json(
      { ok: false, error: "Өөрчлөх талбар байхгүй" },
      { status: 400 },
    );
  }

  const phone = setPhone ? body.phone?.trim() || null : null;
  const telegramRaw = setTelegram ? body.telegram_id?.trim() || null : null;
  if (telegramRaw && !/^\d{5,20}$/.test(telegramRaw)) {
    return NextResponse.json(
      { ok: false, error: "Telegram ID зөвхөн тоо байх ёстой" },
      { status: 400 },
    );
  }

  // Prefer column-safe RPC (cannot escalate role_id etc.)
  const { data: rpcRow, error: rpcError } = await supabase.rpc(
    "update_own_profile_contact",
    {
      p_phone: phone,
      p_telegram_id: telegramRaw,
      p_set_phone: setPhone,
      p_set_telegram: setTelegram,
    },
  );

  if (!rpcError && rpcRow) {
    const row = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
    return NextResponse.json({ ok: true, profile: row });
  }

  // Fallback: service role update of contact fields only
  if (!hasServiceRole()) {
    return NextResponse.json(
      {
        ok: false,
        error: rpcError?.message || "Профайл хадгалж чадсангүй",
      },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const updates: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };
  if (setPhone) updates.phone = phone;
  if (setTelegram) updates.telegram_id = telegramRaw;

  const { data, error } = await admin
    .from("user_profiles")
    .update(updates)
    .eq("user_id", user.id)
    .select(PROFILE_SELECT)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile: data });
}
