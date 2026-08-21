import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel, ScoreChip } from "@/components/ui/primitives";
import { OrgBreadcrumb } from "@/components/org/org-ui";
import { getHeltes, listAlbasInHeltes, orgPath } from "@/lib/db/org";
import { getPolicyScope } from "@/lib/access/scope";
import { isUnitScoped } from "@/lib/access/embed";

export const dynamic = "force-dynamic";

export default async function HeltesPage({
  params,
}: {
  params: Promise<{ heltesId: string }>;
}) {
  const { heltesId: raw } = await params;
  const heltesId = decodeURIComponent(raw);
  const scope = await getPolicyScope();
  if (isUnitScoped(scope) && scope?.heltesId && scope.heltesId !== heltesId) {
    redirect(
      scope.albaId
        ? `/org/heltes/${scope.heltesId}/alba/${scope.albaId}`
        : `/org/heltes/${scope.heltesId}`,
    );
  }
  if (isUnitScoped(scope) && scope?.heltesId === heltesId && scope.albaId) {
    redirect(`/org/heltes/${scope.heltesId}/alba/${scope.albaId}`);
  }
  const heltes = await getHeltes(heltesId);
  if (!heltes) notFound();
  const albas = await listAlbasInHeltes(heltesId);

  return (
    <div>
      <OrgBreadcrumb
        items={[
          { href: "/org", label: "Алба, хэлтэс" },
          { label: heltes.name },
        ]}
      />
      <PageHeader
        title={heltes.name}
        description="Хэлтэс доторх нэгж / алба. Сонгоод журам эсвэл ажлын байр руу орно."
      />
      <Panel>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1.5 pr-2">Нэгж / алба</th>
              <th className="py-1.5 pr-2">Ажлын байр</th>
              <th className="py-1.5 pr-2">Журам</th>
              <th className="py-1.5">Дундаж үнэлгээ</th>
            </tr>
          </thead>
          <tbody>
            {albas.map((a) => (
              <tr key={a.bteg_id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 pr-2">
                  <Link
                    href={orgPath(heltesId, a.bteg_id)}
                    className="font-medium hover:underline"
                  >
                    {a.name}
                  </Link>
                  {a.is_direct ? (
                    <span className="ml-2 text-xs text-slate-500">хэлтэсийн түвшин</span>
                  ) : null}
                </td>
                <td className="py-2 pr-2 tabular-nums">{a.position_count}</td>
                <td className="py-2 pr-2 tabular-nums">{a.policy_count}</td>
                <td className="py-2">
                  <ScoreChip score={a.avg_score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!albas.length ? (
          <p className="text-sm text-slate-500">Энэ хэлтэст алба олдсонгүй.</p>
        ) : null}
      </Panel>
    </div>
  );
}
