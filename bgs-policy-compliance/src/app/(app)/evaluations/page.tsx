import Link from "next/link";
import { Badge, PageHeader, Panel, ScoreChip } from "@/components/ui/primitives";
import { getPolicyOrgAssignments } from "@/lib/db/org";
import {
  listEvaluatedPoliciesByScoreAsc,
  listEvaluations,
  listPositionEvaluationSummaries,
  listAttentionEvaluations,
  listNotedEvaluations,
} from "@/lib/db/repository";
import { AttentionNotificationsPanel } from "@/components/policies/attention-notifications-panel";
import { ExportLink } from "@/components/ui/export-link";
import { formatDate, truncate } from "@/lib/utils";
import { EvaluationsDetailTree } from "./evaluations-detail-tree";

export const dynamic = "force-dynamic";

function unitLabel(
  org: { heltes: string; alba: string } | undefined,
): string {
  if (!org) return "Ангилагдаагүй";
  return [org.heltes, org.alba].filter((x) => x && x !== "—").join(" · ") || "Ангилагдаагүй";
}

export default async function EvaluationsPage() {
  const [policyRows, positionRows, detailRows, policyOrg, attentionItems, notedItems] =
    await Promise.all([
      listEvaluatedPoliciesByScoreAsc(),
      listPositionEvaluationSummaries(),
      listEvaluations(),
      getPolicyOrgAssignments(),
      listAttentionEvaluations(20),
      listNotedEvaluations(40),
    ]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Үнэлгээ"
        description="Зүйл заалтын биелэлт, нийтлэг оноо"
        actions={
          <>
            <Link
              href="/evaluations/new"
              className="rounded bg-slate-900 px-2.5 py-1.5 text-sm text-white"
            >
              Шинэ үнэлгээ
            </Link>
            <ExportLink
              path="/api/export/evaluations"
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
            >
              CSV татах
            </ExportLink>
          </>
        }
      />

      {(attentionItems.length > 0 || notedItems.length > 0) ? (
        <AttentionNotificationsPanel
          urgentItems={attentionItems}
          noteItems={notedItems}
          title="Анхаарах үнэлгээ (дундажаас хассан)"
        />
      ) : null}

      <Panel title="Үнэлсэн журмууд (бага → их)">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Журам</th>
                <th className="py-1.5 pr-2">Нэгж</th>
                <th className="py-1.5 pr-2">Дундаж оноо</th>
                <th className="py-1.5 pr-2">Үнэлгээ</th>
                <th className="py-1.5 pr-2">Зүйл</th>
                <th className="py-1.5">Сүүлд</th>
              </tr>
            </thead>
            <tbody>
              {policyRows.map((r, i) => (
                <tr key={r.policy.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 tabular-nums text-xs text-slate-500">
                    {i + 1}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Link
                      href={`/policies/${r.policy.id}`}
                      className="font-medium hover:underline"
                    >
                      {truncate(r.policy.name, 70)}
                    </Link>
                    {r.policy.reference_code ? (
                      <div className="font-mono text-xs text-slate-500">
                        {r.policy.reference_code}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2 text-xs text-slate-600">
                    {truncate(unitLabel(policyOrg.get(r.policy.id)), 40)}
                  </td>
                  <td className="py-1.5 pr-2">
                    <ScoreChip score={r.avgScore} />
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-xs">
                    {r.evaluationCount}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-xs">{r.clauseCount}</td>
                  <td className="py-1.5 text-xs">{formatDate(r.lastEvaluatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!policyRows.length ? (
          <p className="text-sm text-slate-500">Үнэлсэн журам байхгүй.</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{policyRows.length} журам</p>
        )}
      </Panel>

      <Panel title="Ажилчдын үнэлгээ (ажлын байр, бага → их)">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Ажлын байр</th>
                <th className="py-1.5 pr-2">Нэгж</th>
                <th className="py-1.5 pr-2">Дундаж оноо</th>
                <th className="py-1.5 pr-2">Үнэлгээ</th>
                <th className="py-1.5 pr-2">Журам</th>
                <th className="py-1.5">Сүүлд</th>
              </tr>
            </thead>
            <tbody>
              {positionRows.map((r, i) => (
                <tr key={r.position.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 tabular-nums text-xs text-slate-500">
                    {i + 1}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Link
                      href={`/positions/${r.position.id}`}
                      className="font-medium hover:underline"
                    >
                      {truncate(r.position.name, 50)}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-2 text-xs text-slate-600">
                    {truncate(r.unitLabel, 40)}
                  </td>
                  <td className="py-1.5 pr-2">
                    <ScoreChip score={r.avgScore} />
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-xs">
                    {r.evaluationCount}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-xs">{r.policyCount}</td>
                  <td className="py-1.5 text-xs">{formatDate(r.lastEvaluatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!positionRows.length ? (
          <p className="text-sm text-slate-500">Ажилчдын үнэлгээ байхгүй.</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            {positionRows.length} ажлын байр
          </p>
        )}
      </Panel>

      <Panel title="Бүх үнэлгээ (дэлгэрэнгүй)">
        <EvaluationsDetailTree rows={detailRows} />
      </Panel>
    </div>
  );
}
