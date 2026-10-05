import { PositionsSubnav } from "@/components/positions/positions-subnav";
import { PositionsReviewPanel } from "@/components/positions/positions-review-panel";
import { PageHeader } from "@/components/ui/primitives";
import {
  listOrgPositionAssignTree,
  listPositionsForReview,
} from "@/lib/db/org";

export const dynamic = "force-dynamic";

export default async function PositionsReviewPage() {
  const [allRows, tree] = await Promise.all([
    listPositionsForReview(),
    listOrgPositionAssignTree(),
  ]);

  const orgSet = new Set<string>();
  for (const r of allRows) {
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
        title="Шалгах"
        description="Ажлын байрыг байгууллага → хэлтэс → алба бүтцээр үзэх. Засвар, холбох хэрэгсэл байхгүй."
      />
      <PositionsReviewPanel
        rows={allRows}
        tree={tree}
        orgOptions={orgOptions}
      />
    </div>
  );
}
