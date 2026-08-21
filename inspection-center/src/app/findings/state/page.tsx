import { SimpleBarChart } from "@/components/findings/SimpleBarChart";
import { ViolationTreeTable } from "@/components/findings/ViolationTreeTable";
import { FindingsActionsCrossLinks } from "@/components/access/RelatedFindingsLinks";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/ui/primitives";
import {
  buildStateTree,
  formatCount,
  loadFindingsDashboard,
} from "@/app/findings/data";

export const dynamic = "force-dynamic";

export default async function FindingsStatePage() {
  const dashboard = await loadFindingsDashboard();
  const { tree, violationTotal, openTotal } = buildStateTree(dashboard);
  const authorities = dashboard.state.authorities.filter(
    (row) => row.violationCount > 0,
  );

  return (
    <div className="min-w-0">
      <PageHeader
        title="Төрийн ХШ"
        subtitle="Байгууллага, хяналтын хуудсаар бүртгэгдсэн зөрчил"
      />

      <FindingsActionsCrossLinks />

      <div className="space-y-4">
        <Panel title="4. Төрийн байгууллагын ХШ">
          <SimpleBarChart
            rows={authorities.map((row) => ({
              key: row.key,
              label: row.name,
              values: {
                violations: row.violationCount,
                open: row.openCount,
              },
            }))}
            series={[
              { key: "violations", label: "Зөрчил", color: "#ea580c" },
              { key: "open", label: "Арилаагүй", color: "#b45309" },
            ]}
            emptyMessage="Төрийн ХШ-ийн зөрчил алга"
          />
        </Panel>

        <Panel
          title="Байгууллага/хуудсаар бүртгэгдсэн зөрчил"
          actions={
            <span className="text-xs text-[var(--muted)]">
              Нийт {formatCount(violationTotal)} · Арилаагүй{" "}
              {formatCount(openTotal)}
            </span>
          }
        >
          <ViolationTreeTable
            roots={tree}
            emptyMessage="Бүртгэгдсэн төрийн ХШ-ийн зөрчил алга."
          />
        </Panel>
      </div>
    </div>
  );
}
