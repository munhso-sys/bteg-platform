import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

type Body = {
  full_name?: string;
  email?: string;
  phone?: string;
  heltes_id?: string;
  heltes_name?: string;
  alba_id?: string;
  alba_name?: string;
  position_id?: string | null;
  position_name?: string;
  note?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const full_name = body.full_name?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const phone = body.phone?.trim() ?? "";
    const heltes_id = body.heltes_id?.trim() ?? "";
    const heltes_name = body.heltes_name?.trim() ?? "";
    const alba_id = body.alba_id?.trim() ?? "";
    const alba_name = body.alba_name?.trim() ?? "";
    const position_name = body.position_name?.trim() ?? "";
    const position_id = body.position_id?.trim() || null;
    const note = body.note?.trim() || null;

    if (
      !full_name ||
      !email ||
      !phone ||
      !heltes_id ||
      !heltes_name ||
      !alba_id ||
      !alba_name ||
      !position_name
    ) {
      return NextResponse.json(
        { ok: false, error: "Бүх заавал талбарыг бөглөнө үү." },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Имэйл хаяг буруу байна." },
        { status: 400 },
      );
    }

    const row = {
      full_name,
      email,
      phone,
      heltes_id,
      heltes_name,
      alba_id,
      alba_name,
      position_id,
      position_name,
      note,
      status: "pending" as const,
    };

    if (hasServiceRole()) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("access_requests")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        const duplicate =
          error.code === "23505" ||
          error.message.toLowerCase().includes("duplicate") ||
          error.message.toLowerCase().includes("unique");
        return NextResponse.json(
          {
            ok: false,
            error: duplicate
              ? "Энэ имэйлээр хүлээгдэж буй хүсэлт аль хэдийн байна."
              : error.message,
          },
          { status: duplicate ? 409 : 500 },
        );
      }
      return NextResponse.json({ ok: true, id: data.id });
    }

    // Anon path: insert only (no RETURNING select under RLS)
    const supabase = await createClient();
    const { error } = await supabase.from("access_requests").insert(row);
    if (error) {
      const duplicate =
        error.code === "23505" ||
        error.message.toLowerCase().includes("duplicate") ||
        error.message.toLowerCase().includes("unique");
      return NextResponse.json(
        {
          ok: false,
          error: duplicate
            ? "Энэ имэйлээр хүлээгдэж буй хүсэлт аль хэдийн байна."
            : error.message,
        },
        { status: duplicate ? 409 : 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Хүсэлт илгээхэд алдаа",
      },
      { status: 500 },
    );
  }
}
