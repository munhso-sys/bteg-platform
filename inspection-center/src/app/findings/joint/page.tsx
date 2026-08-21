import { SimpleBarChart } from "@/components/findings/SimpleBarChart";
import { ViolationTreeTable } from "@/components/findings/ViolationTreeTable";
import { FindingsActionsCrossLinks } from "@/components/access/RelatedFindingsLinks";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/ui/primitives";
import {
  buildJointTree,
  formatCount,
  loadFindingsDashboard,
} from "@/app/findings/data";

export const dynamic = "force-dynamic";

export default async function FindingsJointPage() {
  const dashboard = await loadFindingsDashboard();
  const { tree, violationTotal, openTotal } = buildJointTree(dashboard);

  return (
    <div className="min-w-0">
      <PageHeader
        title="Хамтарсан ХШ"
        subtitle="Ангиллаар бүртгэгдсэн зөрчил"
      />

      <FindingsActionsCrossLinks />

      <div className="space-y-4">
        <Panel title="7. Хамтарсан хяналт шалгалт">
          <SimpleBarChart
            rows={dashboard.joint.categories.map((row) => ({
              key: row.key,
              label: row.code,
              values: {
                violations: row.violationCount,
                resolved: row.resolvedCount,
              },
            }))}
            series={[
              { key: "violations", label: "Зөрчил", color: "#0f766e" },
              { key: "resolved", label: "Арилгасан", color: "#14b8a6" },
            ]}
            emptyMessage="Хамтарсан ХШ-ийн зөрчил алга"
          />
        </Panel>

        <Panel
          title="Ангиллаар бүртгэгдсэн зөрчил"
          actions={
            <span className="text-xs text-[var(--muted)]">
              Нийт {formatCount(violationTotal)} · Арилаагүй{" "}
              {formatCount(openTotal)}
            </span>
          }
        >
          <ViolationTreeTable
            roots={tree}
            emptyMessage="Бүртгэгдсэн хамтарсан ХШ-ийн зөрчил алга."
          />
        </Panel>
      </div>
    </div>
  );
}
