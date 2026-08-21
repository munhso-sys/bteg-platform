import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { ChoiceCard, OrgBreadcrumb } from "@/components/org/org-ui";
import { getAlbaContext, orgPath } from "@/lib/db/org";

export const dynamic = "force-dynamic";

export default async function AlbaChoicePage({
  params,
}: {
  params: Promise<{ heltesId: string; albaId: string }>;
}) {
  const raw = await params;
  const heltesId = decodeURIComponent(raw.heltesId);
  const albaId = decodeURIComponent(raw.albaId);
  const { heltes, alba } = await getAlbaContext(heltesId, albaId);
  if (!heltes || !alba) notFound();

  return (
    <div>
      <OrgBreadcrumb
        items={[
          { href: "/org", label: "Алба, хэлтэс" },
          { href: orgPath(heltesId), label: heltes.name },
          { label: alba.name },
        ]}
      />
      <PageHeader
        title={alba.name}
        description={`${heltes.name} · юу үзэхээ сонгоно уу`}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <ChoiceCard
          href={orgPath(heltesId, albaId, "policies")}
          title="Журам"
          description="Энэ албатай холбоотой журмууд, биелэлтийн үнэлгээтэй"
          count={alba.policy_count}
        />
        <ChoiceCard
          href={orgPath(heltesId, albaId, "positions")}
          title="Ажлын байр"
          description="Энэ албаны ажлын байрууд, үнэлгээтэй"
          count={alba.position_count}
        />
      </div>
    </div>
  );
}
