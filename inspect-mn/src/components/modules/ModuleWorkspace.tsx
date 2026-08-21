import { Download, Plus, RefreshCw } from "lucide-react";
import { FilterBar } from "@/components/ui/FilterBar";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectableTable } from "@/components/ui/DataTable";
import type { ModuleDataset } from "@/lib/placeholder-data";

export function ModuleWorkspace({
  title,
  description,
  dataset,
}: {
  title: string;
  description: string;
  dataset: ModuleDataset;
}) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <button type="button" className="btn btn-ghost">
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Шинэчлэх</span>
            </button>
            <button type="button" className="btn btn-ghost">
              <Download size={14} />
              <span className="hidden sm:inline">Экспорт</span>
            </button>
            <button type="button" className="btn btn-primary">
              <Plus size={14} />
              <span className="hidden xs:inline sm:inline">Шинэ</span>
              <span className="sm:hidden">Шинэ</span>
            </button>
          </>
        }
      />

      <section className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {dataset.kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </section>

      <div className="mb-4">
        <FilterBar filters={dataset.filters} />
      </div>

      <SelectableTable rows={dataset.rows} />

      <section className="mt-4 rounded-md border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-3 py-2">
          <h2 className="text-sm font-semibold text-[var(--fg)]">
            {dataset.detailTitle}
          </h2>
        </div>
        <ul className="grid gap-1 p-3 text-sm text-[var(--fg)] sm:grid-cols-2">
          {dataset.detailBody.map((line) => (
            <li
              key={line}
              className="rounded border border-[var(--border)] bg-slate-50 px-3 py-2"
            >
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
