import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader, Panel, ScoreChip, KpiCard } from "@/components/ui/primitives";
import { ChoiceCard, OrgBreadcrumb } from "@/components/org/org-ui";
import { ContextBackLink } from "@/components/policies/policy-back-link";
import { RESPONSIBILITY_LABELS, responsibilityTone } from "@/lib/constants";
import { getAlbaContext, getOrgPositionDetail, orgPath } from "@/lib/db/org";
import { truncate } from "@/lib/utils";
import { JobDescriptionView } from "@/app/(app)/positions/[id]/job-description-view";
import { QuickEvaluateForm } from "@/app/(app)/positions/[id]/quick-evaluate-form";

export const dynamic = "force-dynamic";

export default async function OrgPositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ heltesId: string; albaId: string; positionId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const raw = await params;
  const heltesId = decodeURIComponent(raw.heltesId);
  const albaId = decodeURIComponent(raw.albaId);
  const positionId = decodeURIComponent(raw.positionId);
  const { tab } = await searchParams;
  const activeTab =
    tab === "policies"
      ? "policies"
      : tab === "jd"
        ? "jd"
        : tab === "evaluate"
          ? "evaluate"
          : "choice";

  const [{ heltes, alba }, detail] = await Promise.all([
    getAlbaContext(heltesId, albaId),
    getOrgPositionDetail(positionId),
  ]);
  if (!heltes || !alba || !detail) notFound();

  const base = orgPath(heltesId, albaId, `positions/${positionId}`);
  const evaluatedCount = detail.obligations.filter((o) => o.evaluation).length;

  return (
    <div>
      <div className="mb-3">
        <ContextBackLink
          from="org"
          heltesId={heltesId}
          albaId={albaId}
          tab="positions"
        />
      </div>
      <OrgBreadcrumb
        items={[
          { href: "/org", label: "Алба, хэлтэс" },
          { href: orgPath(heltesId), label: heltes.name },
          { href: orgPath(heltesId, albaId), label: alba.name },
          { href: orgPath(heltesId, albaId, "positions"), label: "Ажлын байр" },
          { label: detail.position.name },
        ]}
      />
      <PageHeader
        title={detail.position.name}
        description={`${heltes.name} · ${alba.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/positions/${positionId}?from=org&heltesId=${encodeURIComponent(heltesId)}&albaId=${encodeURIComponent(albaId)}&tab=positions`}
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
            >
              Дэлгэрэнгүй
            </Link>
            <ScoreChip score={detail.avg_score} />
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiCard label="Холбоотой журам" value={detail.policies.length} />
        <KpiCard label="Үүрэг (холбоос)" value={detail.obligations.length} />
        <KpiCard label="Үнэлсэн" value={evaluatedCount} />
        <KpiCard label="Дундаж үнэлгээ" value={detail.avg_score ?? "—"} />
      </div>

      {activeTab === "choice" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <ChoiceCard
            href={`${base}?tab=jd`}
            title="Ажлын байрны тодорхойлолт"
            description="Зорилго, хуваарь, үүрэг, шаардлага"
            count={detail.description ? "OK" : "—"}
          />
          <ChoiceCard
            href={`${base}?tab=policies`}
            title="Холбогдох журмууд"
            description="Журам, зүйл заалт, үнэлгээ"
            count={detail.obligations.length}
          />
          <ChoiceCard
            href={`${base}?tab=evaluate`}
            title="Үнэлгээ өгөх"
            description="Зүйл заалтад оноо хадгалах"
            count={evaluatedCount}
          />
        </div>
      ) : null}

      {activeTab !== "choice" ? (
        <div className="mb-3 flex w-fit gap-1 rounded border border-slate-300 bg-white p-0.5 text-sm">
          <Link
            href={`${base}?tab=jd`}
            className={
              activeTab === "jd"
                ? "rounded bg-slate-900 px-2.5 py-1 text-white"
                : "rounded px-2.5 py-1 text-slate-700"
            }
          >
            Тодорхойлолт
          </Link>
          <Link
            href={`${base}?tab=policies`}
            className={
              activeTab === "policies"
                ? "rounded bg-slate-900 px-2.5 py-1 text-white"
                : "rounded px-2.5 py-1 text-slate-700"
            }
          >
            Журмууд
          </Link>
          <Link
            href={`${base}?tab=evaluate`}
            className={
              activeTab === "evaluate"
                ? "rounded bg-slate-900 px-2.5 py-1 text-white"
                : "rounded px-2.5 py-1 text-slate-700"
            }
          >
            Үнэлгээ
          </Link>
          <Link href={base} className="rounded px-2.5 py-1 text-slate-500">
            ← Сонголт
          </Link>
        </div>
      ) : null}

      {activeTab === "jd" ? (
        <Panel title="Ажлын байрны тодорхойлолт (АБТ)">
          {!detail.description ? (
            <p className="text-sm text-slate-500">Тодорхойлолт бүртгэгдээгүй.</p>
          ) : (
            <JobDescriptionView description={detail.description} />
          )}
        </Panel>
      ) : null}

      {activeTab === "policies" ? (
        <div className="space-y-3">
          <Panel title="Холбогдох журмууд">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1.5 pr-2">Журам</th>
                  <th className="py-1.5 pr-2">Код</th>
                  <th className="py-1.5 pr-2">Үүргийн тоо</th>
                  <th className="py-1.5">Үнэлгээ</th>
                </tr>
              </thead>
              <tbody>
                {detail.policies.map((row) => (
                  <tr
                    key={row.policy.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 pr-2">
                      <Link
                        href={`/policies/${row.policy.id}?from=org&heltesId=${encodeURIComponent(heltesId)}&albaId=${encodeURIComponent(albaId)}`}
                        className="font-medium hover:underline"
                      >
                        {truncate(row.policy.name, 80)}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {row.policy.reference_code || "—"}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{row.obligation_count}</td>
                    <td className="py-2">
                      <ScoreChip score={row.avg_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!detail.policies.length ? (
              <p className="text-sm text-slate-500">Холбоотой журам олдсонгүй.</p>
            ) : null}
          </Panel>

          <Panel title="Зүйл заалтын холбоос">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1.5 pr-2">Журам / зүйл</th>
                  <th className="py-1.5 pr-2">Үүрэг</th>
                  <th className="py-1.5">Оноо</th>
                </tr>
              </thead>
              <tbody>
                {detail.obligations.map(({ link, clause, policy, evaluation }) => (
                  <tr key={link.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">
                      <div className="font-medium">
                        {policy ? (
                          <Link
                            href={`/policies/${policy.id}?from=org&heltesId=${encodeURIComponent(heltesId)}&albaId=${encodeURIComponent(albaId)}`}
                            className="hover:underline"
                          >
                            {truncate(policy.name, 50)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </div>
                      {clause ? (
                        <Link
                          href={`/clauses/${clause.id}`}
                          className="text-xs text-slate-600 hover:underline"
                        >
                          {clause.reference_number}{" "}
                          {truncate(clause.text, 70)}
                        </Link>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Badge className={responsibilityTone(link.responsibility_type)}>
                        {RESPONSIBILITY_LABELS[link.responsibility_type]}
                      </Badge>
                    </td>
                    <td className="py-1.5">
                      <ScoreChip score={evaluation?.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!detail.obligations.length ? (
              <p className="text-sm text-slate-500">Идэвхтэй холбоос байхгүй.</p>
            ) : null}
          </Panel>
        </div>
      ) : null}

      {activeTab === "evaluate" ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <Panel title="Үүргийн жагсаалт">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1.5 pr-2">Зүйл</th>
                  <th className="py-1.5 pr-2">Үүрэг</th>
                  <th className="py-1.5">Оноо</th>
                </tr>
              </thead>
              <tbody>
                {detail.obligations.map(({ link, clause, policy, evaluation }) => (
                  <tr key={link.id} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">
                      <div className="text-xs text-slate-500">
                        {truncate(policy?.name ?? "", 40)}
                      </div>
                      {clause ? (
                        <Link
                          href={`/clauses/${clause.id}`}
                          className="hover:underline"
                        >
                          <span className="font-mono text-xs">
                            {clause.reference_number}
                          </span>{" "}
                          {truncate(clause.text, 60)}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <Badge className={responsibilityTone(link.responsibility_type)}>
                        {RESPONSIBILITY_LABELS[link.responsibility_type]}
                      </Badge>
                    </td>
                    <td className="py-1.5">
                      <ScoreChip score={evaluation?.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!detail.obligations.length ? (
              <p className="text-sm text-slate-500">Үнэлэх үүрэг байхгүй.</p>
            ) : null}
          </Panel>
          <Panel title="Шинэ үнэлгээ">
            <QuickEvaluateForm
              positionId={positionId}
              obligations={detail.obligations.map(({ link, clause, policy }) => ({
                clause_id: link.policy_clause_id,
                type: link.responsibility_type,
                label: `${truncate(policy?.name ?? "", 28)} · ${clause?.reference_number ?? "—"} · ${RESPONSIBILITY_LABELS[link.responsibility_type]}`,
              }))}
            />
            <p className="mt-3 text-xs text-slate-500">
              Хадгалсны дараа{" "}
              <Link href="/evaluations" className="underline">
                Үнэлгээ
              </Link>{" "}
              хуудсанд харагдана.
            </p>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
