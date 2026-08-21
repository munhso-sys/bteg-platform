import { PageHeader, Panel } from "@/components/ui/primitives";
import { RESPONSIBILITY_LABELS } from "@/lib/constants";
import { getMatrixRows, listPolicies } from "@/lib/db/repository";
import { ExportLink } from "@/components/ui/export-link";
import { truncate } from "@/lib/utils";
import type { ResponsibilityType } from "@/lib/types";
import { MatrixTree } from "./matrix-tree";

export const dynamic = "force-dynamic";

export default async function MatrixPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    policyId?: string;
    type?: ResponsibilityType;
  }>;
}) {
  const sp = await searchParams;
  const [rows, policies] = await Promise.all([
    getMatrixRows({
      q: sp.q,
      policyId: sp.policyId,
      responsibilityType: sp.type,
    }),
    listPolicies(),
  ]);

  return (
    <div>
      <PageHeader
        title="Хариуцлагын холбоосын хүснэгт"
        description="Зүйл заалт × ажлын байрны холбоос, сүүлийн үнэлгээтэй"
        actions={
          <ExportLink
            path="/api/export/matrix"
            className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
          >
            CSV татах
          </ExportLink>
        }
      />

      <Panel className="mb-3">
        <form className="flex flex-wrap gap-2 text-sm">
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Хайх…"
            className="rounded border border-slate-300 px-2 py-1.5"
          />
          <select
            name="policyId"
            defaultValue={sp.policyId || ""}
            className="max-w-xs rounded border border-slate-300 px-2 py-1.5"
          >
            <option value="">Бүх журам</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {truncate(p.name, 60)}
              </option>
            ))}
          </select>
          <select
            name="type"
            defaultValue={sp.type || ""}
            className="rounded border border-slate-300 px-2 py-1.5"
          >
            <option value="">Бүх үүрэг</option>
            {(Object.keys(RESPONSIBILITY_LABELS) as ResponsibilityType[]).map((t) => (
              <option key={t} value={t}>
                {RESPONSIBILITY_LABELS[t]}
              </option>
            ))}
          </select>
          <button className="rounded bg-slate-900 px-3 py-1.5 text-white">Шүүх</button>
        </form>
      </Panel>

      <Panel>
        <MatrixTree rows={rows} />
      </Panel>
    </div>
  );
}
