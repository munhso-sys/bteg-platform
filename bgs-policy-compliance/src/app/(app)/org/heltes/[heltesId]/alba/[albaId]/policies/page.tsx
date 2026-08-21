import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel, ScoreChip, Badge } from "@/components/ui/primitives";
import { OrgBreadcrumb } from "@/components/org/org-ui";
import { ContextBackLink } from "@/components/policies/policy-back-link";
import {
  getAlbaContext,
  listAlbaPolicies,
  listAlbaPolicyPositions,
  orgPath,
} from "@/lib/db/org";
import { formatDate, truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlbaPoliciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ heltesId: string; albaId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const raw = await params;
  const heltesId = decodeURIComponent(raw.heltesId);
  const albaId = decodeURIComponent(raw.albaId);
  const { view } = await searchParams;
  const showPositions = view === "positions";

  const { heltes, alba } = await getAlbaContext(heltesId, albaId);
  if (!heltes || !alba) notFound();

  const [policies, positions] = await Promise.all([
    listAlbaPolicies(heltesId, albaId),
    listAlbaPolicyPositions(heltesId, albaId),
  ]);

  const base = orgPath(heltesId, albaId, "policies");

  return (
    <div>
      <div className="mb-3">
        <ContextBackLink
          from="org"
          heltesId={heltesId}
          albaId={albaId}
          tab={showPositions ? "positions" : "policies"}
        />
      </div>
      <OrgBreadcrumb
        items={[
          { href: "/org", label: "Алба, хэлтэс" },
          { href: orgPath(heltesId), label: heltes.name },
          { href: orgPath(heltesId, albaId), label: alba.name },
          { label: "Журам" },
        ]}
      />
      <PageHeader
        title={`Журам · ${alba.name}`}
        description="Журам бүрийн биелэлтийн дундаж үнэлгээ. Сонголтоор холбогдох ажлын байруудыг үнэлгээтэй харна."
        actions={
          <div className="flex gap-1 rounded border border-slate-300 bg-white p-0.5 text-sm">
            <Link
              href={base}
              className={
                !showPositions
                  ? "rounded bg-slate-900 px-2.5 py-1 text-white"
                  : "rounded px-2.5 py-1 text-slate-700"
              }
            >
              Журмын жагсаалт
            </Link>
            <Link
              href={`${base}?view=positions`}
              className={
                showPositions
                  ? "rounded bg-slate-900 px-2.5 py-1 text-white"
                  : "rounded px-2.5 py-1 text-slate-700"
              }
            >
              Холбогдох ажлын байр
            </Link>
          </div>
        }
      />

      {!showPositions ? (
        <Panel>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1.5 pr-2">Журам</th>
                <th className="py-1.5 pr-2">Код</th>
                <th className="py-1.5 pr-2">Зүйл</th>
                <th className="py-1.5 pr-2">Ажлын байр</th>
                <th className="py-1.5 pr-2">Үнэлгээ</th>
                <th className="py-1.5">Батлагдсан</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((row) => (
                <tr key={row.policy.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-2">
                    <Link
                      href={`/policies/${row.policy.id}?from=org&heltesId=${encodeURIComponent(heltesId)}&albaId=${encodeURIComponent(albaId)}&tab=policies`}
                      className="font-medium hover:underline"
                    >
                      {truncate(row.policy.name, 90)}
                    </Link>
                    {"scope_label" in row && row.scope_label ? (
                      <div className="text-xs text-slate-500">{row.scope_label}</div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs">
                    {row.policy.reference_code || "—"}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{row.clause_count}</td>
                  <td className="py-2 pr-2 tabular-nums">{row.linked_position_count}</td>
                  <td className="py-2 pr-2">
                    <ScoreChip score={row.avg_score} />
                    {row.evaluation_count ? (
                      <span className="ml-1 text-xs text-slate-500">
                        ({row.evaluation_count})
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-xs">{formatDate(row.policy.approved_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!policies.length ? (
            <p className="text-sm text-slate-500">Холбоотой журам олдсонгүй.</p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">{policies.length} журам</p>
          )}
        </Panel>
      ) : (
        <Panel title="Холбогдох ажлын байрууд (үнэлгээтэй)">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1.5 pr-2">Ажлын байр</th>
                <th className="py-1.5 pr-2">Тодорхойлолт</th>
                <th className="py-1.5 pr-2">Үүрэг</th>
                <th className="py-1.5 pr-2">Журам</th>
                <th className="py-1.5">Үнэлгээ</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((row) => (
                <tr key={row.position.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-2">
                    <Link
                      href={orgPath(
                        heltesId,
                        albaId,
                        `positions/${row.position.id}`,
                      )}
                      className="font-medium hover:underline"
                    >
                      {row.position.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-2">
                    {row.has_job_description ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Тийм</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-900">Үгүй</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{row.obligation_count}</td>
                  <td className="py-2 pr-2 tabular-nums">{row.related_policy_count}</td>
                  <td className="py-2">
                    <ScoreChip score={row.avg_score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!positions.length ? (
            <p className="text-sm text-slate-500">Холбоотой ажлын байр олдсонгүй.</p>
          ) : null}
        </Panel>
      )}
    </div>
  );
}
