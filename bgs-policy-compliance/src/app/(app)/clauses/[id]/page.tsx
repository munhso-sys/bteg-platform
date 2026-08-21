import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, PageHeader, Panel, ScoreChip } from "@/components/ui/primitives";
import { RESPONSIBILITY_LABELS, responsibilityTone } from "@/lib/constants";
import { getDb, latestEvaluations } from "@/lib/db/repository";
import { getPolicyScope } from "@/lib/access/scope";
import { isPositionScoped } from "@/lib/access/embed";
import { truncate } from "@/lib/utils";
import { ClauseEvaluateForm } from "./clause-evaluate-form";
import { UnlinkResponsibilityButton } from "./unlink-responsibility-button";

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
  const latest = latestEvaluations(
    db.compliance_evaluations.filter(
      (e) =>
        e.policy_clause_id === id &&
        (!readOnly || e.job_position_id === scope?.positionId),
    ),
  );
  const children = db.policy_clauses.filter((c) => c.parent_id === id && !c.is_deleted);

  return (
    <div>
      <PageHeader
        title={`${clause.reference_number || "Зүйл"}`}
        description={clause.text}
        actions={
          policy ? (
            <Link href={`/policies/${policy.id}`} className="text-sm hover:underline">
              ← {truncate(policy.name, 50)}
            </Link>
          ) : null
        }
      />

      <div className={readOnly ? "space-y-3" : "grid gap-3 lg:grid-cols-[1fr_320px]"}>
        <Panel title={readOnly ? "Миний үүрэг" : "Үүргээр холбогдсон ажлын байр"}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1.5 pr-2">Ажлын байр</th>
                <th className="py-1.5 pr-2">Үүрэг</th>
                <th className="py-1.5 pr-2">Сүүлийн оноо</th>
                {!readOnly ? <th className="py-1.5 text-right">Салгах</th> : null}
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const evalRow = latest.find(
                  (e) =>
                    e.job_position_id === l.job_position_id &&
                    e.responsibility_type === l.responsibility_type,
                );
                const pos = positions.get(l.job_position_id);
                const posName = pos?.name ?? l.job_position_id;
                return (
                  <tr key={l.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">
                      {readOnly ? (
                        posName
                      ) : (
                        <Link
                          href={`/positions/${l.job_position_id}`}
                          className="hover:underline"
                        >
                          {posName}
                        </Link>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Badge className={responsibilityTone(l.responsibility_type)}>
                        {RESPONSIBILITY_LABELS[l.responsibility_type]}
                      </Badge>
                    </td>
                    <td className="py-1.5 pr-2">
                      <ScoreChip score={evalRow?.score} />
                    </td>
                    {!readOnly ? (
                      <td className="py-1.5 text-right">
                        <UnlinkResponsibilityButton
                          linkId={l.id}
                          label={`${posName} · ${RESPONSIBILITY_LABELS[l.responsibility_type]}`}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!links.length ? (
            <p className="text-sm text-slate-500">Хариуцлагын холбоос байхгүй.</p>
          ) : null}
        </Panel>

        {!readOnly ? (
          <div className="space-y-3">
            <Panel title="Холбогдсон ажлын байрыг үнэлэх">
              <ClauseEvaluateForm
                clauseId={id}
                links={links.map((l) => ({
                  job_position_id: l.job_position_id,
                  responsibility_type: l.responsibility_type,
                  label: `${positions.get(l.job_position_id)?.name ?? l.job_position_id} · ${RESPONSIBILITY_LABELS[l.responsibility_type]}`,
                }))}
              />
            </Panel>
            <Panel title="Дэд зүйлүүд">
              <ul className="space-y-1 text-sm">
                {children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clauses/${c.id}`} className="hover:underline">
                      <span className="font-mono text-xs">{c.reference_number}</span>{" "}
                      {truncate(c.text, 80)}
                    </Link>
                  </li>
                ))}
                {!children.length ? (
                  <li className="text-slate-500">Дэд зүйл байхгүй.</li>
                ) : null}
              </ul>
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  );
}
