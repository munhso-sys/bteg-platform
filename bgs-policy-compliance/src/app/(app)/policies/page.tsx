import { PoliciesSubnav } from "@/components/policies/policies-subnav";
import { PageHeader } from "@/components/ui/primitives";
import {
  getPolicyOrgAssignments,
  listOrgAssignTree,
} from "@/lib/db/org";
import { listPolicies, getDb } from "@/lib/db/repository";
import { CreatePolicyDialog } from "./create-policy-dialog";
import { PoliciesTable } from "./policies-table";

export const dynamic = "force-dynamic";

export default async function PoliciesPage({
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
        title="Удирдлага"
        description="Журам, журмын баримт бичгийг харах, засварлах. Хэлтэс/алба сонголт бүх нэгжийн холбоост хамаарна."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <form>
              <input
                name="q"
                defaultValue={q}
                placeholder="Нэр эсвэл кодоор хайх…"
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </form>
            <CreatePolicyDialog tree={tree} />
          </div>
        }
      />

      <div className="min-w-0">
        <PoliciesTable initialRows={rows} tree={tree} mode="manage" />
      </div>
    </div>
  );
}
