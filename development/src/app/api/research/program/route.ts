import { NextResponse } from "next/server";
import { requireResearchAuth, mutationOk } from "@/lib/research/auth";
import { createUserServerClient } from "@/lib/supabase/server";
import type { ProgramInitiative, QuarterKey } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProgramRow = {
  id: string;
  organization_id: string;
  pillar_id: string;
  no: number;
  title: string;
  owner: string;
  department: string;
  score: number;
  target: number;
  status: string;
  year: number;
  start_date: string;
  end_date: string;
  quarters: Record<string, string>;
};

function rowToInitiative(row: ProgramRow): ProgramInitiative {
  return {
    id: row.id,
    pillarId: row.pillar_id as ProgramInitiative["pillarId"],
    no: row.no,
    title: row.title,
    owner: row.owner,
    department: row.department,
    score: Number(row.score),
    target: Number(row.target),
    status: row.status as ProgramInitiative["status"],
    year: row.year,
    start_date: row.start_date,
    end_date: row.end_date,
    quarters: {
      q1: (row.quarters?.q1 as ProgramInitiative["quarters"][QuarterKey]) || "none",
      q2: (row.quarters?.q2 as ProgramInitiative["quarters"][QuarterKey]) || "none",
      q3: (row.quarters?.q3 as ProgramInitiative["quarters"][QuarterKey]) || "none",
      q4: (row.quarters?.q4 as ProgramInitiative["quarters"][QuarterKey]) || "none",
    },
  };
}

function initiativeToRow(
  item: Partial<ProgramInitiative>,
  organizationId: string,
  userId: string,
) {
  return {
    organization_id: organizationId,
    created_by: userId,
    updated_by: userId,
    pillar_id: item.pillarId ?? "research",
    no: item.no ?? 0,
    title: item.title ?? "",
    owner: item.owner ?? "",
    department: item.department ?? "",
    score: Number(item.score) || 0,
    target: Number(item.target) || 100,
    status: item.status ?? "planned",
    year: item.year ?? new Date().getFullYear(),
    start_date: item.start_date ?? "",
    end_date: item.end_date ?? "",
    quarters: item.quarters ?? { q1: "none", q2: "none", q3: "none", q4: "none" },
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const supabase = await createUserServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase missing" }, { status: 503 });
  }
  const auth = await requireResearchAuth(supabase);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { data, error } = await supabase
    .from("research_program_initiatives")
    .select("*")
    .eq("organization_id", auth.ctx.organizationId)
    .order("year", { ascending: false })
    .order("no", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    items: ((data ?? []) as ProgramRow[]).map(rowToInitiative),
    organizationId: auth.ctx.organizationId,
  });
}

export async function POST(request: Request) {
  const supabase = await createUserServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase missing" }, { status: 503 });
  }
  const auth = await requireResearchAuth(supabase);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: Partial<ProgramInitiative>;
  try {
    body = (await request.json()) as Partial<ProgramInitiative>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });
  }
  if (
    body &&
    "organization_id" in body &&
    String((body as { organization_id?: string }).organization_id) !==
      auth.ctx.organizationId
  ) {
    return NextResponse.json(
      { ok: false, error: "Forged organization_id rejected" },
      { status: 403 },
    );
  }

  const insert = initiativeToRow(body, auth.ctx.organizationId, auth.ctx.user.id);
  const { data, error } = await supabase
    .from("research_program_initiatives")
    .insert(insert)
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Insert failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, item: rowToInitiative(data as ProgramRow) });
}

export async function PATCH(request: Request) {
  const supabase = await createUserServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase missing" }, { status: 503 });
  }
  const auth = await requireResearchAuth(supabase);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: Partial<ProgramInitiative> & { id?: string };
  try {
    body = (await request.json()) as Partial<ProgramInitiative> & { id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const patch = initiativeToRow(body, auth.ctx.organizationId, auth.ctx.user.id);
  delete (patch as { created_by?: string }).created_by;
  delete (patch as { organization_id?: string }).organization_id;

  const { data, error } = await supabase
    .from("research_program_initiatives")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", auth.ctx.organizationId)
    .select("*");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  if (!mutationOk(data?.length)) {
    return NextResponse.json(
      { ok: false, error: "No row updated (missing or cross-org)" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, item: rowToInitiative(data![0] as ProgramRow) });
}

export async function DELETE(request: Request) {
  const supabase = await createUserServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase missing" }, { status: 503 });
  }
  const auth = await requireResearchAuth(supabase);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("research_program_initiatives")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.ctx.organizationId)
    .select("id");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  if (!mutationOk(data?.length)) {
    return NextResponse.json({ ok: false, error: "No row deleted" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
