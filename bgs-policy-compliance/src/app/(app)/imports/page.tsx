import { PageHeader, Panel, KpiCard } from "@/components/ui/primitives";
import { getDb } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const db = await getDb();
  const report = db.meta.import_report;

  return (
    <div>
      <PageHeader
        title="Импорт"
        description="BGS экспортын ачааллын төлөв. Дахин ажиллуулах: npm run data:refresh"
      />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiCard label="Журам" value={report?.policies ?? 0} />
        <KpiCard label="Зүйл заалт" value={report?.clauses ?? 0} />
        <KpiCard label="Ажлын байр" value={report?.job_positions ?? 0} />
        <KpiCard label="Холбоос" value={report?.responsibility_links ?? 0} />
      </div>
      <Panel title="Сүүлийн импортын тайлан">
        {!report ? (
          <p className="text-sm text-slate-500">Импорт хийгдээгүй.</p>
        ) : (
          <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(
              {
                imported_at: db.meta.imported_at,
                source_path: db.meta.source_path,
                ...report,
                missing_positions: report.missing_positions.slice(0, 20),
              },
              null,
              2,
            )}
          </pre>
        )}
      </Panel>
      <Panel title="Хүлээгдэж буй суурь тоо" className="mt-3">
        <ul className="list-disc pl-5 text-sm text-slate-700">
          <li>73 журам</li>
          <li>618 ажлын байр</li>
          <li>53 ажлын байрны тодорхойлолт</li>
          <li>2,417 зүйл–ажлын байрны холбоос</li>
          <li>5,835 зүйл / дэд заалт</li>
        </ul>
      </Panel>
    </div>
  );
}
