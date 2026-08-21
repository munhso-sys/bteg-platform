import { redirect } from "next/navigation";
import { PageHeader, Panel, KpiCard } from "@/components/ui/primitives";
import { OrgBreadcrumb } from "@/components/org/org-ui";
import { OrgExplorer } from "@/components/org/org-explorer";
import { listOrgExplorerTree } from "@/lib/db/org";
import { getPolicyScope } from "@/lib/access/scope";
import { isUnitScoped } from "@/lib/access/embed";

export const dynamic = "force-dynamic";

export default async function OrgIndexPage({
  searchParams,
}: {
  searchParams: Promise<{
    heltesId?: string;
    albaId?: string;
    tab?: string;
  }>;
}) {
  const sp = await searchParams;
  const scope = await getPolicyScope();
  if (isUnitScoped(scope) && scope?.heltesId) {
    const dest =
      scope.albaId
        ? `/org/heltes/${scope.heltesId}/alba/${scope.albaId}`
        : `/org/heltes/${scope.heltesId}`;
    redirect(dest);
  }

  const tree = await listOrgExplorerTree();
  const initialOpen =
    sp.heltesId && sp.albaId
      ? {
          heltesId: sp.heltesId,
          albaId: sp.albaId,
          tab: (sp.tab === "positions" ? "positions" : "policies") as
            | "policies"
            | "positions",
        }
      : null;

  return (
    <div>
      <OrgBreadcrumb items={[{ label: "Алба, хэлтэс" }]} />
      <PageHeader
        title="Алба, хэлтэс"
        description="Хэлтэс → алба бүтцээр харна. Журам / ажлын байрын жагсаалт нэмэлт цонхонд нээгдэнэ."
      />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiCard label="Хэлтэс" value={tree.length} />
        <KpiCard
          label="Нийт ажлын байр"
          value={tree.reduce((s, h) => s + h.positionCount, 0)}
        />
        <KpiCard
          label="Нийт журам (холбоос)"
          value={tree.reduce((s, h) => s + h.policyCount, 0)}
        />
        <KpiCard
          label="Албатай хэлтэс"
          value={tree.filter((h) => h.albaCount > 0).length}
        />
      </div>
      <Panel>
        <OrgExplorer tree={tree} initialOpen={initialOpen} />
      </Panel>
    </div>
  );
}
