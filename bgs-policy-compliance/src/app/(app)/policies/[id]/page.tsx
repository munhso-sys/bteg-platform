import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PolicyScopeWorkbench } from "@/components/policies/policy-scope-workbench";
import { PolicyEditorLayout } from "@/components/policies/policy-editor-layout";
import { ContextBackLink } from "@/components/policies/policy-back-link";
import { Badge, PageHeader, ScoreChip } from "@/components/ui/primitives";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import {
  POLICY_STATUS_LABELS,
  RESPONSIBILITY_LABELS,
  SCOPE_TYPE_LABELS,
} from "@/lib/constants";
import {
  listOrgAssignTree,
  listOrgPositionAssignTree,
  resolvePositionsOrgLabels,
} from "@/lib/db/org";
import { getPolicyDetail } from "@/lib/db/repository";
import { getPolicyDetailForPosition } from "@/lib/access/policy-scope-data";
import { getPolicyScope } from "@/lib/access/scope";
import { isPositionScoped } from "@/lib/access/embed";
import { formatDate } from "@/lib/utils";
import type { LinkScoreRow } from "@/lib/policy-kpis";
import type { PolicyStatus, ResponsibilityType } from "@/lib/types";
import { AddSectionForm } from "./add-section-form";
import { AddClauseForm } from "./add-clause-form";
import {
  type PolicyEvalOption,
} from "./policy-evaluate-form";

export const dynamic = "force-dynamic";

function buildPolicyEvalOptions(
  responsibilities: Array<{
    policy_clause_id: string;
    job_position_id: string;
    responsibility_type: ResponsibilityType;
  }>,
  positions: Map<string, string>,
  clauses: Array<{ id: string; label: string; sectionId?: string | null }>,
  sections: Array<{ id: string; label: string }>,
  policyName: string,
): PolicyEvalOption[] {
  const options: PolicyEvalOption[] = [];

  const byPosType = new Map<
    string,
    {
      job_position_id: string;
      responsibility_type: ResponsibilityType;
      clauseIds: Set<string>;
    }
  >();
  for (const r of responsibilities) {
    const key = `${r.job_position_id}::${r.responsibility_type}`;
    let row = byPosType.get(key);
    if (!row) {
      row = {
        job_position_id: r.job_position_id,
        responsibility_type: r.responsibility_type,
        clauseIds: new Set(),
      };
      byPosType.set(key, row);
    }
    row.clauseIds.add(r.policy_clause_id);
  }

  const byType = new Map<
    ResponsibilityType,
    { clauseIds: Set<string>; positionIds: Set<string> }
  >();
  for (const r of responsibilities) {
    let row = byType.get(r.responsibility_type);
    if (!row) {
      row = { clauseIds: new Set(), positionIds: new Set() };
      byType.set(r.responsibility_type, row);
    }
    row.clauseIds.add(r.policy_clause_id);
    row.positionIds.add(r.job_position_id);
  }
  for (const [type, row] of byType) {
    options.push({
      id: `policy::${type}`,
      label: `${policyName} · бүх холбоос · ${RESPONSIBILITY_LABELS[type]} (${row.positionIds.size} ажлын байр × ${row.clauseIds.size} зүйл) — нийтээр`,
      group: "Журам (нийтээр)",
      policy_clause_ids: [...row.clauseIds],
      job_position_ids: [...row.positionIds],
      responsibility_type: type,
    });
  }

  for (const s of sections) {
    const sectionClauseIds = new Set(
      clauses.filter((c) => (c.sectionId ?? null) === s.id).map((c) => c.id),
    );
    if (!sectionClauseIds.size) continue;
    const bySecType = new Map<
      ResponsibilityType,
      { clauseIds: Set<string>; positionIds: Set<string> }
    >();
    for (const r of responsibilities) {
      if (!sectionClauseIds.has(r.policy_clause_id)) continue;
      let row = bySecType.get(r.responsibility_type);
      if (!row) {
        row = { clauseIds: new Set(), positionIds: new Set() };
        bySecType.set(r.responsibility_type, row);
      }
      row.clauseIds.add(r.policy_clause_id);
      row.positionIds.add(r.job_position_id);
    }
    for (const [type, row] of bySecType) {
      options.push({
        id: `section:${s.id}::${type}`,
        label: `${s.label} · ${RESPONSIBILITY_LABELS[type]} (${row.positionIds.size} ажлын байр × ${row.clauseIds.size} зүйл) — нийтээр`,
        group: "Хэсэг (нийтээр)",
        policy_clause_ids: [...row.clauseIds],
        job_position_ids: [...row.positionIds],
        responsibility_type: type,
      });
    }
  }

  for (const [key, row] of byPosType) {
    const name = positions.get(row.job_position_id) ?? row.job_position_id;
    options.push({
      id: `pos:${key}`,
      label: `${name} · ${RESPONSIBILITY_LABELS[row.responsibility_type]} (${row.clauseIds.size} зүйл)`,
      group: "Ажлын байраар (холбогдсон зүйлүүд)",
      policy_clause_ids: [...row.clauseIds],
      job_position_ids: [row.job_position_id],
      responsibility_type: row.responsibility_type,
    });
  }

  return options;
}

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
  const orgTree = readOnly
    ? null
    : await listOrgAssignTree().catch(() => listOrgPositionAssignTree());

  if (!detail) {
    if (readOnly) redirect("/my");
    notFound();
  }

  const positionNames = new Map(detail.positions.map((p) => [p.id, p.name]));
  const orgLabels = await resolvePositionsOrgLabels(
    detail.responsibilities.map((r) => r.job_position_id),
  );
  const scores = new Map(
    detail.latestEvaluations.map((e) => [
      `${e.policy_clause_id}:${e.job_position_id}:${e.responsibility_type}`,
      e,
    ]),
  );
  const evidenceById =
    "evaluationEvidenceById" in detail && detail.evaluationEvidenceById
      ? (detail.evaluationEvidenceById as Record<string, string>)
      : {};

  const clauseRows = detail.clauses.map((c) => ({
    id: c.id,
    label: `${c.reference_number || "—"} ${c.text.slice(0, 60)}`,
    sectionId: c.section_id,
    parentId: c.parent_id,
  }));
  const sectionRows = detail.sections.map((s) => ({
    id: s.id,
    label: `${s.reference_number || ""} ${s.text || s.id}`.trim(),
  }));

  const evalOptions = readOnly
    ? []
    : buildPolicyEvalOptions(
        detail.responsibilities,
        positionNames,
        clauseRows,
        sectionRows,
        detail.policy.name,
      );

  const linkRows: LinkScoreRow[] = detail.responsibilities.map((r) => {
    const org = orgLabels.get(r.job_position_id);
    const evaluation = scores.get(
      `${r.policy_clause_id}:${r.job_position_id}:${r.responsibility_type}`,
    );
    return {
      id: r.id,
      policy_clause_id: r.policy_clause_id,
      job_position_id: r.job_position_id,
      responsibility_type: r.responsibility_type,
      positionName: positionNames.get(r.job_position_id) ?? r.job_position_id,
      heltesName: org?.heltesName,
      albaName: org?.albaName,
      score: evaluation?.score ?? null,
      notes: r.notes,
      weight: r.weight ?? 1,
      required_evidence: r.required_evidence ?? null,
      process_id: r.process_id ?? null,
      location_id: r.location_id ?? null,
      asset_id: r.asset_id ?? null,
      excludeFromAverage: evaluation?.exclude_from_average === true,
      hasCountedNote:
        evaluation != null &&
        evaluation.exclude_from_average !== true &&
        !!(
          evaluation.comment?.trim() ||
          evidenceById[evaluation.id]?.trim()
        ),
      hasNoteContent: !!(
        evaluation?.comment?.trim() ||
        (evaluation ? evidenceById[evaluation.id]?.trim() : "")
      ),
      evaluationId: evaluation?.id ?? null,
      attentionComment: evaluation?.comment ?? null,
      attentionEvidence: evaluation
        ? (evidenceById[evaluation.id] ?? null)
        : null,
    };
  });

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

      {!readOnly && detail.scope.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {detail.scope.map((s) => (
            <Badge key={String(s.id)} className="bg-slate-100 text-slate-700">
              {SCOPE_TYPE_LABELS[s.target_type] ?? s.target_type}:{" "}
              {s.target_name || s.target_bteg_id}
            </Badge>
          ))}
        </div>
      ) : null}

      <div
        className={readOnly ? "space-y-3" : undefined}
      >
        {readOnly ? (
          detail.trees.length === 0 ? (
            <p className="text-sm text-slate-500">
              Таны ажлын байрт холбоос байхгүй.
            </p>
          ) : (
            <PolicyScopeWorkbench
              policyId={id}
              policyName={detail.policy.name}
              readOnly={readOnly}
              orgTree={orgTree}
              sections={sectionRows}
              trees={detail.trees.map(({ section, tree }) => ({
                section: {
                  id: section.id,
                  reference_number: section.reference_number,
                  text: section.text,
                },
                tree,
              }))}
              clauses={clauseRows}
              linkRows={linkRows}
              policyEvalOptions={evalOptions}
            />
          )
        ) : (
          <PolicyEditorLayout
            policyId={id}
            clauses={clauseRows}
            linkRows={linkRows}
            workbench={
              detail.trees.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Таны ажлын байрт холбоос байхгүй.
                </p>
              ) : (
                <PolicyScopeWorkbench
                  policyId={id}
                  policyName={detail.policy.name}
                  readOnly={readOnly}
                  orgTree={orgTree}
                  sections={sectionRows}
                  trees={detail.trees.map(({ section, tree }) => ({
                    section: {
                      id: section.id,
                      reference_number: section.reference_number,
                      text: section.text,
                    },
                    tree,
                  }))}
                  clauses={clauseRows}
                  linkRows={linkRows}
                  policyEvalOptions={evalOptions}
                />
              )
            }
            sidebarTop={
              <>
                <CollapsiblePanel title="Хэсэг нэмэх" defaultOpen={false}>
                  <AddSectionForm policyId={id} />
                </CollapsiblePanel>
                <CollapsiblePanel title="Зүйл нэмэх" defaultOpen={false}>
                  <AddClauseForm
                    policyId={id}
                    sections={detail.sections.map((s) => ({
                      id: s.id,
                      label: `${s.reference_number || ""} ${s.text || s.id}`.trim(),
                    }))}
                  />
                </CollapsiblePanel>
              </>
            }
          />
        )}
      </div>
    </div>
  );
}
