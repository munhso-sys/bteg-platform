import type {
  ClausePositionResponsibility,
  ClauseTreeNode,
  PolicyClause,
} from "@/lib/types";
import { buildClauseTree, getPolicyDetail } from "@/lib/db/repository";

function collectAncestors(
  clauseId: string,
  byId: Map<string, PolicyClause>,
  into: Set<string>,
) {
  let current: string | null | undefined = clauseId;
  while (current) {
    if (into.has(current)) break;
    into.add(current);
    current = byId.get(current)?.parent_id ?? null;
  }
}

function pruneTree(
  nodes: ClauseTreeNode[],
  keep: Set<string>,
): ClauseTreeNode[] {
  const out: ClauseTreeNode[] = [];
  for (const n of nodes) {
    const children = pruneTree(n.children, keep);
    if (keep.has(n.id) || children.length) {
      out.push({ ...n, children });
    }
  }
  return out;
}

/** Policy detail limited to clauses linked to a job position. */
export async function getPolicyDetailForPosition(
  policyId: string,
  positionId: string,
) {
  const detail = await getPolicyDetail(policyId);
  if (!detail) return null;

  const links = detail.responsibilities.filter(
    (r) => r.job_position_id === positionId && r.is_active,
  ) as ClausePositionResponsibility[];
  if (!links.length) return null;

  const linkedIds = new Set(links.map((l) => l.policy_clause_id));
  const byId = new Map(detail.clauses.map((c) => [c.id, c]));
  const keep = new Set<string>();
  for (const id of linkedIds) collectAncestors(id, byId, keep);

  const clauses = detail.clauses.filter((c) => keep.has(c.id));
  const responsibilities = links;
  const positions = detail.positions.filter((p) => p.id === positionId);
  const latestEvaluations = detail.latestEvaluations.filter(
    (e) => e.job_position_id === positionId && linkedIds.has(e.policy_clause_id),
  );

  const trees = detail.sections.map((section) => ({
    section,
    tree: pruneTree(
      buildClauseTree(clauses, responsibilities, section.id),
      linkedIds,
    ),
  })).filter((t) => t.tree.length > 0);

  const sectionIds = new Set(detail.sections.map((s) => s.id));
  const orphans = clauses.filter((c) => !c.section_id || !sectionIds.has(c.section_id));
  if (orphans.length) {
    const tree = pruneTree(
      buildClauseTree(orphans, responsibilities, null),
      linkedIds,
    );
    if (tree.length) {
      trees.push({
        section: {
          id: "orphan",
          policy_id: policyId,
          text: "Хэсэггүй",
          reference_number: null,
          sort_order: 9999,
          is_deleted: false,
        },
        tree,
      });
    }
  }

  return {
    ...detail,
    clauses,
    responsibilities,
    positions,
    trees,
    latestEvaluations,
    avgScore:
      latestEvaluations.length === 0
        ? null
        : Math.round(
            (latestEvaluations.reduce((s, e) => s + e.score, 0) /
              latestEvaluations.length) *
              10,
          ) / 10,
  };
}
