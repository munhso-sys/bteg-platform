import { PageHeader, Panel } from "@/components/ui/primitives";
import {
  getSharedDashboardBundle,
  importInspectEvidenceAsEvaluation,
  mapInspectFindingToClause,
} from "@/lib/inspect/adapter";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [shared, evidenceStub, findingStub] = await Promise.all([
    getSharedDashboardBundle(),
    importInspectEvidenceAsEvaluation({ inspect_record_id: "demo" }),
    mapInspectFindingToClause({
      inspect_finding_id: "demo",
      finding_summary: "demo",
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Тохиргоо ба Inspect холболт"
        description="Inspect системтэй холбох адаптерын бэлтгэл. Нэгж бүтэц: Тохиргоо → Байгууллага · нэгж."
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Нэвтрэлт">
          <p className="text-sm text-slate-600">
            Аппын түвшний нэвтрэлтийн бэлтгэл. Supabase Auth бэлэн болоход холбоно.
            Нэвтрэх хаяг: <code className="font-mono text-xs">/login</code>.
          </p>
        </Panel>
        <Panel title="Supabase">
          <p className="text-sm text-slate-600">
            Схем: <code className="font-mono text-xs">supabase/migrations/</code>.
            Одоогоор локал өгөгдөл: <code className="font-mono text-xs">data/local/db.json</code>.
          </p>
        </Panel>
        <Panel title="Inspect адаптерын төлөв" className="lg:col-span-2">
          <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify({ shared, evidenceStub, findingStub }, null, 2)}
          </pre>
          <p className="mt-2 text-sm text-slate-600">
            Нөөцлөгдсөн хүснэгтүүд: inspect_policy_clause_links, inspect_evidence_links, corrective_actions.
          </p>
        </Panel>
      </div>
    </div>
  );
}
