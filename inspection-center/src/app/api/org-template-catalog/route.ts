import { NextResponse } from "next/server";
import { getInspectionScope } from "@/lib/access/scope";
import { isUnitScopedInspection } from "@/lib/access/embed";
import { fetchOrgCatalog } from "@/lib/org-template/catalog";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await getInspectionScope();
  if (isUnitScopedInspection(scope)) {
    return NextResponse.json(
      { ok: false, error: "Нэгжийн хэрэглэгч каталог харах эрхгүй" },
      { status: 403 },
    );
  }

  try {
    const [org, data] = await Promise.all([
      fetchOrgCatalog(),
      Promise.resolve(readStore()),
    ]);
    const templates = data.templates
      .filter((t) => t.active !== false)
      .map((t) => ({
        id: t.id,
        title: t.title,
        code: t.code ?? null,
        category: t.category ?? null,
      }))
      .sort((a, b) =>
        `${a.code ?? ""} ${a.title}`.localeCompare(
          `${b.code ?? ""} ${b.title}`,
          "mn",
        ),
      );

    return NextResponse.json({
      ok: true,
      heltes: org.heltes,
      templates,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Каталог уншиж чадсангүй",
      },
      { status: 500 },
    );
  }
}
