import { PositionsSubnav } from "@/components/positions/positions-subnav";
import { PositionsManagePanel } from "@/components/positions/positions-manage-panel";
import { PageHeader } from "@/components/ui/primitives";
import {
  listOrgPositionAssignTree,
  listPositionsForOrgTree,
} from "@/lib/db/org";
import { CreatePositionDialog } from "./create-position-dialog";

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

  const orgSet = new Set<string>();
  for (const r of rows) {
    orgSet.add(r.organization_name.trim() || "__none__");
  }
  const orgOptions = [...orgSet]
    .sort((a, b) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return a.localeCompare(b, "mn");
    })
    .map((value) => ({
      value,
      label: value === "__none__" ? "Ангилагдаагүй" : value,
    }));

  return (
    <div>
      <PositionsSubnav />
      <PageHeader
        title="Удирдлага"
        description="Байгууллага → хэлтэс → алба бүтцээр ангилж харах, сонголтоор холбох"
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <form>
              <input
                name="q"
                defaultValue={q}
                placeholder="Нэр / байгууллага / нэгжээр хайх…"
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </form>
            <CreatePositionDialog tree={tree} />
          </div>
        }
      />
      <PositionsManagePanel rows={rows} tree={tree} orgOptions={orgOptions} />
    </div>
  );
}
