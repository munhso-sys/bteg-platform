import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { BulkUnlinkScopeButton } from "@/components/policies/bulk-unlink-scope-button";
import { getPolicyScope } from "@/lib/access/scope";
import { isPositionScoped } from "@/lib/access/embed";
import { resolvePositionsOrgLabels } from "@/lib/db/org";
import {
  evaluationsWithActiveLinks,
  getDb,
  latestEvaluations,
} from "@/lib/db/repository";
import { OTHER_ALBA_ID, OTHER_HELTES_ID, parseScopeNote } from "@/lib/org-assign";
import { truncate } from "@/lib/utils";
import {
  ClauseLinksPanel,
  type ClauseLinkRow,
} from "./clause-links-panel";

export const dynamic = "force-dynamic";

export default async function ClauseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await getPolicyScope();
  const readOnly = isPositionScoped(scope);
  const db = await getDb();
  const clause = db.policy_clauses.find((c) => c.id === id);
  if (!clause) notFound();
  const policy = db.policies.find((p) => p.id === clause.policy_id);

  let links = db.clause_position_responsibilities.filter(
    (r) => r.policy_clause_id === id && r.is_active,
  );

  if (readOnly) {
    if (!scope?.positionId) redirect("/my");
    links = links.filter((l) => l.job_position_id === scope.positionId);
    if (!links.length) redirect("/my");
  }

  const positions = new Map(db.job_positions.map((p) => [p.id, p]));
  const orgLabels = await resolvePositionsOrgLabels(
    links.map((l) => l.job_position_id),
  );

  const latest = latestEvaluations(
    evaluationsWithActiveLinks(
      db.compliance_evaluations.filter(
        (e) =>
          e.policy_clause_id === id &&
          (!readOnly || e.job_position_id === scope?.positionId),
      ),
      links,
    ),
  );
  const children = db.policy_clauses.filter(
    (c) => c.parent_id === id && !c.is_deleted,
  );

  const rows: ClauseLinkRow[] = links.map((l) => {
    const pos = positions.get(l.job_position_id);
    const org = orgLabels.get(l.job_position_id);
    const scopeParsed = parseScopeNote(l.notes);
    let heltesId = org?.heltesId ?? OTHER_HELTES_ID;
    let heltesName = org?.heltesName ?? "Ангилагдаагүй";
    let albaId = org?.albaId ?? OTHER_ALBA_ID;
    let albaName = org?.albaName ?? "—";
    if (scopeParsed?.kind === "heltes" && org) {
      heltesId = org.heltesId;
      heltesName = org.heltesName;
    }
    const evalRow = latest.find(
      (e) =>
        e.job_position_id === l.job_position_id &&
        e.responsibility_type === l.responsibility_type,
    );
    return {
      id: l.id,
      job_position_id: l.job_position_id,
      responsibility_type: l.responsibility_type,
      notes: l.notes,
      positionName: pos?.name ?? l.job_position_id,
      organizationName:
        org?.organizationName || (pos?.organization_name ?? "").trim(),
      heltesId,
      heltesName,
      albaId,
      albaName,
      score: evalRow?.score ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title={`${clause.reference_number || "Зүйл"}`}
        description={clause.text}
        actions={
          policy ? (
            <Link
              href={`/policies/${policy.id}`}
              className="text-sm hover:underline"
            >
              ← {truncate(policy.name, 50)}
            </Link>
          ) : null
        }
      />

      <div
        className={
          readOnly ? "space-y-3" : "grid gap-3 lg:grid-cols-[1fr_320px]"
        }
      >
        <Panel
          title={
            readOnly ? "Миний үүрэг" : "Үүргээр холбогдсон ажлын байр"
          }
          actions={
            !readOnly && rows.length > 0 ? (
              <BulkUnlinkScopeButton
                variant="icon"
                clauseId={id}
                label="Зүйлийн бүх холбоосыг салгах"
                confirmLabel={`${clause.reference_number || "Зүйл"}`}
              />
            ) : null
          }
        >
          <ClauseLinksPanel
            clauseId={id}
            links={rows}
            readOnly={readOnly}
          />
        </Panel>

        {!readOnly ? (
          <Panel title="Дэд зүйлүүд">
            <ul className="space-y-1 text-sm">
              {children.map((c) => (
                <li key={c.id}>
                  <Link href={`/clauses/${c.id}`} className="hover:underline">
                    <span className="font-mono text-xs">
                      {c.reference_number}
                    </span>{" "}
                    {truncate(c.text, 80)}
                  </Link>
                </li>
              ))}
              {!children.length ? (
                <li className="text-slate-500">Дэд зүйл байхгүй.</li>
              ) : null}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
