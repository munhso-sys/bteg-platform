import Link from "next/link";
import { PageHeader, Panel, KpiCard } from "@/components/ui/primitives";
import { ResponsibilityBarChart } from "@/components/charts/charts";
import { RESPONSIBILITY_LABELS } from "@/lib/constants";
import { listOrgUnitComplianceRows } from "@/lib/db/org";
import {
  getDashboardStats,
  getDataQualityWarnings,
  listAttentionEvaluations,
  listNotedEvaluations,
} from "@/lib/db/repository";
import { AttentionNotificationsPanel } from "@/components/policies/attention-notifications-panel";
import { OrgUnitComplianceTable } from "./org-unit-compliance-table";
import { getPolicyScope } from "@/lib/access/scope";
import { isUnitScoped } from "@/lib/access/embed";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Do not mutate org data during dashboard render (P0-03).
  // Naming corrections belong on explicit scoped maintenance paths only.
  const scope = await getPolicyScope();
  const [stats, warnings, unitRowsRaw, attentionItems, notedItems] =
    await Promise.all([
      getDashboardStats(),
      getDataQualityWarnings(),
      listOrgUnitComplianceRows(),
      listAttentionEvaluations(25),
      listNotedEvaluations(40),
    ]);

  const unitRows = isUnitScoped(scope)
    ? unitRowsRaw.filter((row) => {
        if (scope?.albaId && row.id === scope.albaId) return true;
        if (scope?.heltesId && row.id === scope.heltesId) return true;
        const n = `${row.name} ${row.heltesName ?? ""}`.toLowerCase();
        const labels = [scope?.albaName, scope?.heltesName]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase());
        return labels.some((l) => n.includes(l) || l.includes(n));
      })
    : unitRowsRaw;

  const chartData = stats.scoreByResponsibility.map((r) => ({
    name: RESPONSIBILITY_LABELS[r.type],
    avg: r.avg ?? 0,
    count: r.count,
  }));

  const unitLabel = scope?.albaName || scope?.heltesName || null;

  return (
    <div className="min-w-0 max-w-full">
      <PageHeader
        title="Хянах самбар"
        description={
          isUnitScoped(scope) && unitLabel
            ? `Зөвхөн таны нэгж: ${unitLabel}`
            : stats.importedAt
              ? `Өгөгдөл импортлогдсон: ${new Date(stats.importedAt).toLocaleString("mn-MN")} · ${stats.importReport?.policies ?? 0} журам`
              : "BGS экспорт ачаалахын тулд npm run import:bgs ажиллуулна уу"
        }
        actions={
          isUnitScoped(scope) ? null : (
            <Link
              href="/imports"
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50"
            >
              Импортын төлөв
            </Link>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <KpiCard label="Журам" value={stats.totalPolicies} />
        <KpiCard label="Зүйл заалт" value={stats.totalClauses} />
        <KpiCard label="Ажлын байр" value={stats.totalPositions} />
        <KpiCard label="Холбоос" value={stats.totalLinks} />
        <KpiCard label="Үнэлгээний гүйцэтгэл" value={`${stats.evaluationCompletionRate}%`} />
        <KpiCard label="Дундаж оноо" value={stats.averageScore ?? "—"} />
        <KpiCard label="Нийцээгүй" value={stats.nonCompliantCount} />
        <KpiCard
          label="Анхаарах"
          value={stats.attentionCount ?? 0}
          hint="Дундажаас хассан тэмдэглэгээ"
          compact
        />
      </div>

      {(attentionItems.length > 0 || notedItems.length > 0) ? (
        <div className="mb-4">
          <AttentionNotificationsPanel
            urgentItems={attentionItems}
            noteItems={notedItems}
          />
        </div>
      ) : null}

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <Panel title="Үүргийн төрлөөрх биелэлт" className="min-w-0">
          <div className="h-scroll-panel">
            <div className="min-w-[640px]">
              <ResponsibilityBarChart data={chartData} />
              {!chartData.some((d) => d.count > 0) ? (
                <p className="mt-2 text-xs text-slate-500">
                  Үнэлгээ байхгүй. Үнэлгээ хэсэг эсвэл ажлын байр / зүйл заалтын
                  дэлгэрэнгүйгээс оноо оруулна уу.
                </p>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel title="Өгөгдлийн чанарын анхааруулга" className="min-w-0">
          <div className="h-scroll-panel">
            <div className="min-w-[520px]">
              {warnings.length === 0 ? (
                <p className="text-sm text-slate-500">Анхааруулга байхгүй.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {warnings.map((w) => (
                    <li
                      key={w.code}
                      className="flex items-center justify-between gap-4 py-2"
                    >
                      <span className="whitespace-nowrap">{w.message}</span>
                      <span className="shrink-0 font-mono text-xs text-slate-600">
                        {w.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Алба, хэлтэсийн журмын биелэлт/үнэлгээний дундаж оноо"
          className="min-w-0 lg:col-span-2"
          actions={
            <span className="text-xs font-normal text-slate-500">
              Бүх хэлтэс, алба · бага → их
            </span>
          }
        >
          {unitRows.length === 0 ? (
            <p className="text-sm text-slate-500">Нэгж олдсонгүй.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-600">
                Хэлтэс, алба бүрийн ажлын байрны сүүлийн үнэлгээгээр дундаж оноо
                тооцсон. Оноо 0–100 (100 = бүрэн нийцсэн). Холбогдох журам =
                нэгжид оноогдсон журам; үнэлсэн журам = оноо орсон журам. Нүдний
                icon-оор журмын нэрийг харна.
              </p>
              <OrgUnitComplianceTable rows={unitRows} />
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
