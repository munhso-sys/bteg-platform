import { PageHeader, Panel } from "@/components/ui/primitives";
import { PoliciesSubnav } from "@/components/policies/policies-subnav";
import {
  getPolicyOrgAssignments,
  listOrgAssignTree,
} from "@/lib/db/org";
import { listPolicies, getDb } from "@/lib/db/repository";
import { PoliciesTable } from "../policies-table";

export const dynamic = "force-dynamic";

export default async function PoliciesReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [policies, db, orgAssign, tree] = await Promise.all([
    listPolicies(q),
    getDb(),
    getPolicyOrgAssignments(),
    listOrgAssignTree(),
  ]);
  const clauseCount = new Map<string, number>();
  for (const c of db.policy_clauses) {
    if (c.is_deleted) continue;
    clauseCount.set(c.policy_id, (clauseCount.get(c.policy_id) ?? 0) + 1);
  }

  const rows = policies.map((policy) => ({
    policy,
    clauseCount: clauseCount.get(policy.id) ?? 0,
    org: orgAssign.get(policy.id) ?? null,
  }));

  return (
    <div>
      <PoliciesSubnav />
      <PageHeader
        title="Шалгах"
        description="Журмыг бүрэн эхээр үзэх. Засвар, холбоос, үнэлгээний хэрэгсэл байхгүй."
        actions={
          <form>
            <input
              name="q"
              defaultValue={q}
              placeholder="Нэр эсвэл кодоор хайх…"
              className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--fg)]"
            />
          </form>
        }
      />

      <Panel title="Журмын жагсаалт">
        <PoliciesTable initialRows={rows} tree={tree} mode="review" />
      </Panel>
    </div>
  );
}
