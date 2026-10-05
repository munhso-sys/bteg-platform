import { NextResponse } from "next/server";
import { requireResearchAuth, mutationOk } from "@/lib/research/auth";
import { projectToRow, rowToProject, type ResearchProjectRow } from "@/lib/research/map";
import { createUserServerClient } from "@/lib/supabase/server";
import type { ResearchProject } from "@/lib/types";

export const dynamic = "force-dynamic";

function accessToken(request: Request) {
  const raw = request.headers.get("authorization")?.trim() || "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : null;
}

async function authed(request: Request) {
  const supabase = await createUserServerClient(request);
  if (!supabase) {
    return {
      error: NextResponse.json({ ok: false, error: "Supabase missing" }, { status: 503 }),
    };
  }
  const auth = await requireResearchAuth(supabase, accessToken(request));
  if (!auth.ok) {
    return {
      error: NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }),
    };
  }
  return { supabase, auth };
}

export async function GET(request: Request) {
  const gate = await authed(request);
  if ("error" in gate && gate.error) return gate.error;
  const { supabase, auth } = gate as {
    supabase: NonNullable<Awaited<ReturnType<typeof createUserServerClient>>>;
    auth: Extract<Awaited<ReturnType<typeof requireResearchAuth>>, { ok: true }>;
  };

  const { data, error } = await supabase
    .from("research_projects")
    .select("*")
    .eq("organization_id", auth.ctx.organizationId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const projects = ((data ?? []) as ResearchProjectRow[]).map(rowToProject);
  return NextResponse.json({ ok: true, projects, organizationId: auth.ctx.organizationId });
}

export async function POST(request: Request) {
  const gate = await authed(request);
  if ("error" in gate && gate.error) return gate.error;
  const { supabase, auth } = gate as {
    supabase: NonNullable<Awaited<ReturnType<typeof createUserServerClient>>>;
    auth: Extract<Awaited<ReturnType<typeof requireResearchAuth>>, { ok: true }>;
  };

  let body: Partial<ResearchProject>;
  try {
    body = (await request.json()) as Partial<ResearchProject>;
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

  const insert = projectToRow(body, auth.ctx.organizationId, auth.ctx.user.id);
  const { data, error, count } = await supabase
    .from("research_projects")
    .insert(insert)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Insert failed" },
      { status: 400 },
    );
  }

  void count;
  return NextResponse.json({
    ok: true,
    project: rowToProject(data as ResearchProjectRow),
  });
}

export async function PATCH(request: Request) {
  const gate = await authed(request);
  if ("error" in gate && gate.error) return gate.error;
  const { supabase, auth } = gate as {
    supabase: NonNullable<Awaited<ReturnType<typeof createUserServerClient>>>;
    auth: Extract<Awaited<ReturnType<typeof requireResearchAuth>>, { ok: true }>;
  };

  let body: Partial<ResearchProject> & { id?: string };
  try {
    body = (await request.json()) as Partial<ResearchProject> & { id?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const patch = projectToRow(body, auth.ctx.organizationId, auth.ctx.user.id);
  delete (patch as { created_by?: string }).created_by;
  delete (patch as { organization_id?: string }).organization_id;

  const { data, error, count } = await supabase
    .from("research_projects")
    .update({ ...patch, updated_by: auth.ctx.user.id })
    .eq("id", id)
    .eq("organization_id", auth.ctx.organizationId)
    .select("*");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  if (!mutationOk(data?.length ?? count)) {
    return NextResponse.json(
      { ok: false, error: "No row updated (missing or cross-org)" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    project: rowToProject(data![0] as ResearchProjectRow),
  });
}

export async function DELETE(request: Request) {
  const gate = await authed(request);
  if ("error" in gate && gate.error) return gate.error;
  const { supabase, auth } = gate as {
    supabase: NonNullable<Awaited<ReturnType<typeof createUserServerClient>>>;
    auth: Extract<Awaited<ReturnType<typeof requireResearchAuth>>, { ok: true }>;
  };

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("research_projects")
    .delete()
    .eq("id", id)
    .eq("organization_id", auth.ctx.organizationId)
    .select("id");

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  if (!mutationOk(data?.length)) {
    return NextResponse.json(
      { ok: false, error: "No row deleted" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
