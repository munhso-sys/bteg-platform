import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClauseTree } from "@/components/policies/clause-tree";
import { ContextBackLink } from "@/components/policies/policy-back-link";
import { Badge, PageHeader, Panel, ScoreChip } from "@/components/ui/primitives";
import { POLICY_STATUS_LABELS, SCOPE_TYPE_LABELS } from "@/lib/constants";
import { listOrgPositionAssignTree } from "@/lib/db/org";
import { getPolicyDetail } from "@/lib/db/repository";
import { getPolicyDetailForPosition } from "@/lib/access/policy-scope-data";
import { getPolicyScope } from "@/lib/access/scope";
import { isPositionScoped } from "@/lib/access/embed";
import { formatDate } from "@/lib/utils";
import type { PolicyStatus } from "@/lib/types";
import { AddSectionForm } from "./add-section-form";
import { AddClauseForm } from "./add-clause-form";
import { AssignResponsibilityForm } from "./assign-responsibility-form";

export const dynamic = "force-dynamic";

export default async function PolicyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string;
    heltesId?: string;
    albaId?: string;
    tab?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const scope = await getPolicyScope();
  const readOnly = isPositionScoped(scope);

  const detail = readOnly
    ? scope?.positionId
      ? await getPolicyDetailForPosition(id, scope.positionId)
      : null
    : await getPolicyDetail(id);
  const orgTree = readOnly ? null : await listOrgPositionAssignTree();

  if (!detail) {
    if (readOnly) redirect("/my");
    notFound();
  }

  const positionNames = new Map(detail.positions.map((p) => [p.id, p.name]));
  const scores = new Map(
    detail.latestEvaluations.map((e) => [
      `${e.policy_clause_id}:${e.job_position_id}:${e.responsibility_type}`,
      e.score,
    ]),
  );

  return (
    <div>
      {!readOnly ? (
        <div className="mb-3">
          <ContextBackLink
            from={sp.from}
            heltesId={sp.heltesId}
            albaId={sp.albaId}
            tab={sp.tab}
          />
        </div>
      ) : (
        <div className="mb-3">
          <Link href="/my" className="text-sm text-orange-700 hover:underline">
            ← Миний үүрэг
          </Link>
        </div>
      )}
      <PageHeader
        title={detail.policy.name}
        description={
          readOnly
            ? `${detail.policy.reference_code || "Кодгүй"} · зөвхөн таны ажлын байрын ${detail.responsibilities.length} холбоос`
            : `${detail.policy.reference_code || "Кодгүй"} · батлагдсан ${formatDate(detail.policy.approved_date)} · ${detail.clauses.length} зүйл · ${detail.responsibilities.length} холбоос`
        }
        actions={
          <>
            {!readOnly ? (
              <Link
                href={`/policies/${id}/matrix`}
                className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
              >
                Журмын хүснэгт
              </Link>
            ) : null}
            <ScoreChip score={detail.avgScore} />
            <Badge className="bg-slate-100 text-slate-700">
              {POLICY_STATUS_LABELS[detail.policy.status as PolicyStatus] ??
                detail.policy.status}
            </Badge>
          </>
        }
      />

      {!readOnly ? (
        <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
          {detail.scope.map((s) => (
            <Badge key={String(s.id)} className="bg-slate-100 text-slate-700">
              {SCOPE_TYPE_LABELS[s.target_type] ?? s.target_type}:{" "}
              {s.target_name || s.target_bteg_id}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className={readOnly ? "space-y-3" : "grid gap-3 lg:grid-cols-[1fr_300px]"}>
        <div className="space-y-3">
          {detail.trees.map(({ section, tree }) => (
            <Panel
              key={section.id}
              title={`Хэсэг ${section.reference_number || ""} ${section.text || ""}`.trim()}
            >
              <ClauseTree tree={tree} positionNames={positionNames} scores={scores} />
            </Panel>
          ))}
          {detail.trees.length === 0 ? (
            <p className="text-sm text-slate-500">Таны ажлын байрт холбоос байхгүй.</p>
          ) : null}
        </div>
        {!readOnly ? (
          <div className="space-y-3">
            <Panel title="Хэсэг нэмэх">
              <AddSectionForm policyId={id} />
            </Panel>
            <Panel title="Зүйл нэмэх">
              <AddClauseForm
                policyId={id}
                sections={detail.sections.map((s) => ({
                  id: s.id,
                  label: `${s.reference_number || ""} ${s.text || s.id}`.trim(),
                }))}
              />
            </Panel>
            <Panel title="Хариуцлага оноох">
              {orgTree ? (
                <AssignResponsibilityForm
                  tree={orgTree}
                  clauses={detail.clauses.map((c) => ({
                    id: c.id,
                    label: `${c.reference_number || "—"} ${c.text.slice(0, 60)}`,
                  }))}
                />
              ) : null}
            </Panel>
            <Panel title="Холбогдсон ажлын байр">
              <ul className="max-h-80 space-y-1 overflow-auto text-sm">
                {detail.positions.map((p) => (
                  <li key={p.id}>
                    <Link href={`/positions/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  );
}
