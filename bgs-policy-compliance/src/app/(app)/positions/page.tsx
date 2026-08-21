import { PageHeader, Panel } from "@/components/ui/primitives";
import {
  listOrgPositionAssignTree,
  listPositionsForOrgTree,
} from "@/lib/db/org";
import { CreatePositionForm } from "./create-position-form";
import { PositionsOrgTree } from "./positions-org-tree";

export const dynamic = "force-dynamic";

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [rows, tree] = await Promise.all([
    listPositionsForOrgTree(q),
    listOrgPositionAssignTree(),
  ]);

  return (
    <div>
      <PageHeader
        title="Ажлын байр"
        description="Байгууллага → хэлтэс → алба бүтцээр ангилж харах, сонголтоор холбох"
        actions={
          <form>
            <input
              name="q"
              defaultValue={q}
              placeholder="Нэр / байгууллага / нэгжээр хайх…"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </form>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <Panel>
          <PositionsOrgTree rows={rows} tree={tree} />
        </Panel>
        <Panel title="Ажлын байр үүсгэх">
          <CreatePositionForm tree={tree} />
        </Panel>
      </div>
    </div>
  );
}
