import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { ChoiceCard, OrgBreadcrumb } from "@/components/org/org-ui";
import { getAlbaContext, orgPath } from "@/lib/db/org";
import { getPolicyScope } from "@/lib/access/scope";
import { canAccessPolicyPath } from "@/lib/access/menu-route-guard";

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

  const scope = await getPolicyScope();
  const menus = Array.isArray(scope?.menus) ? scope.menus : null;
  const submenus =
    scope?.submenus && typeof scope.submenus === "object"
      ? scope.submenus
      : null;

  const policiesHref = orgPath(heltesId, albaId, "policies");
  const positionsHref = orgPath(heltesId, albaId, "positions");
  const canPolicies = canAccessPolicyPath(policiesHref, menus, submenus);
  const canPositions = canAccessPolicyPath(positionsHref, menus, submenus);

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
      {!canPolicies && !canPositions ? (
        <p className="text-sm text-slate-600">
          Энэ албаны журам / ажлын байрын удирдлагын цэс танд нээлттэй биш байна.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {canPolicies ? (
            <ChoiceCard
              href={policiesHref}
              title="Журам"
              description="Энэ албатай холбоотой журмууд, биелэлтийн үнэлгээтэй"
              count={alba.policy_count}
            />
          ) : null}
          {canPositions ? (
            <ChoiceCard
              href={positionsHref}
              title="Ажлын байр"
              description="Энэ албаны ажлын байрууд, үнэлгээтэй"
              count={alba.position_count}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
