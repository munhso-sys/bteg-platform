import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader, Panel, ScoreChip } from "@/components/ui/primitives";
import { RESPONSIBILITY_LABELS, responsibilityTone } from "@/lib/constants";
import { getMatrixRows, getPolicyDetail } from "@/lib/db/repository";
import { truncate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PolicyMatrixPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPolicyDetail(id);
  if (!detail) notFound();
  const rows = await getMatrixRows({ policyId: id });

  return (
    <div>
      <PageHeader
        title={`Хүснэгт · ${detail.policy.name}`}
        description="Энэ журмын зүйл × ажлын байрны хариуцлагын хүснэгт"
        actions={
          <Link href={`/policies/${id}`} className="text-sm text-slate-600 hover:underline">
            ← Журам руу буцах
          </Link>
        }
      />
      <Panel>
        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-1.5 pr-2">Зүйл</th>
                <th className="py-1.5 pr-2">Ажлын байр</th>
                <th className="py-1.5 pr-2">Үүрэг</th>
                <th className="py-1.5">Оноо</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.link.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2">
                    <span className="font-mono text-xs text-slate-500">
                      {r.clause?.reference_number}
                    </span>{" "}
                    {truncate(r.clause?.text ?? "", 80)}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Link href={`/positions/${r.position?.id}`} className="hover:underline">
                      {r.position?.name}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-2">
                    <Badge className={responsibilityTone(r.link.responsibility_type)}>
                      {RESPONSIBILITY_LABELS[r.link.responsibility_type]}
                    </Badge>
                  </td>
                  <td className="py-1.5">
                    <ScoreChip score={r.evaluation?.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
