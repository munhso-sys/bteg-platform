import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel, ScoreChip, Badge } from "@/components/ui/primitives";
import { OrgBreadcrumb } from "@/components/org/org-ui";
import { ContextBackLink } from "@/components/policies/policy-back-link";
import { getAlbaContext, listAlbaPositions, orgPath } from "@/lib/db/org";

export const dynamic = "force-dynamic";

export default async function AlbaPositionsPage({
  params,
}: {
  params: Promise<{ heltesId: string; albaId: string }>;
}) {
  const raw = await params;
  const heltesId = decodeURIComponent(raw.heltesId);
  const albaId = decodeURIComponent(raw.albaId);
  const { heltes, alba } = await getAlbaContext(heltesId, albaId);
  if (!heltes || !alba) notFound();
  const positions = await listAlbaPositions(heltesId, albaId);

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
          { label: "Ажлын байр" },
        ]}
      />
      <PageHeader
        title={`Ажлын байр · ${alba.name}`}
        description="Ажлын байр сонгоод тодорхойлолт эсвэл холбогдох журмуудыг харна"
      />
      <Panel>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1.5 pr-2">Ажлын байр</th>
              <th className="py-1.5 pr-2">BTEG</th>
              <th className="py-1.5 pr-2">Тодорхойлолт</th>
              <th className="py-1.5 pr-2">Үүрэг</th>
              <th className="py-1.5">Үнэлгээ</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((row) => (
              <tr key={row.position.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 pr-2">
                  <Link
                    href={orgPath(heltesId, albaId, `positions/${row.position.id}`)}
                    className="font-medium hover:underline"
                  >
                    {row.position.name}
                  </Link>
                </td>
                <td className="py-2 pr-2 font-mono text-xs">
                  {row.position.bteg_id || "—"}
                </td>
                <td className="py-2 pr-2">
                  {row.has_job_description ? (
                    <Badge className="bg-emerald-100 text-emerald-800">Тийм</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-900">Үгүй</Badge>
                  )}
                </td>
                <td className="py-2 pr-2 tabular-nums">{row.obligation_count}</td>
                <td className="py-2">
                  <ScoreChip score={row.avg_score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!positions.length ? (
          <p className="text-sm text-slate-500">Ажлын байр олдсонгүй.</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{positions.length} ажлын байр</p>
        )}
      </Panel>
    </div>
  );
}
