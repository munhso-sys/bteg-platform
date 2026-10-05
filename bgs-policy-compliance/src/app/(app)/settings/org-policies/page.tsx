import { PageHeader } from "@/components/ui/primitives";
import { OrgPoliciesClient } from "./OrgPoliciesClient";

export const dynamic = "force-dynamic";

export default function OrgPoliciesSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Алба · журам холбох"
        description="Алба, хэлтэс бүрт холбогдох журмуудыг хувиарлана. Нэгж нэмэх/хасах: Тохиргоо → Байгууллага · нэгж."
      />
      <OrgPoliciesClient />
    </div>
  );
}
