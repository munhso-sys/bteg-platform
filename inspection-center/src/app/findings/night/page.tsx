import { SimpleBarChart } from "@/components/findings/SimpleBarChart";
import { ViolationTreeTable } from "@/components/findings/ViolationTreeTable";
import { FindingsActionsCrossLinks } from "@/components/access/RelatedFindingsLinks";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/ui/primitives";
import {
  buildNightTree,
  formatCount,
  loadFindingsDashboard,
} from "@/app/findings/data";

export const dynamic = "force-dynamic";

export default async function FindingsNightPage() {
  const dashboard = await loadFindingsDashboard();
  const { tree, violationTotal, openTotal } = buildNightTree(dashboard);

  return (
    <div className="min-w-0">
      <PageHeader
        title="Шөнийн ХШ"
        subtitle="Талбай, хэсгээр бүртгэгдсэн зөрчил"
      />

      <FindingsActionsCrossLinks />

      <div className="space-y-4">
        <Panel title="5. Шөнийн хяналт шалгалт">
          <SimpleBarChart
            rows={dashboard.night.areas.map((row) => ({
              key: row.key,
              label: row.name,
              values: {
                violations: row.violationCount,
                open: row.openCount,
              },
            }))}
            series={[
              { key: "violations", label: "Зөрчил", color: "#d97706" },
              { key: "open", label: "Арилаагүй", color: "#92400e" },
            ]}
            emptyMessage="Шөнийн ХШ-ийн зөрчил алга"
          />
        </Panel>

        <Panel
          title="Талбай/хэсгээр бүртгэгдсэн зөрчил"
          actions={
            <span className="text-xs text-[var(--muted)]">
              Нийт {formatCount(violationTotal)} · Арилаагүй{" "}
              {formatCount(openTotal)}
            </span>
          }
        >
          <ViolationTreeTable
            roots={tree}
            emptyMessage="Бүртгэгдсэн шөнийн ХШ-ийн зөрчил алга."
          />
        </Panel>
      </div>
    </div>
  );
}
