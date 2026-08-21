import { PageHeader } from "@/components/layout/PageHeader";
import { OrgTemplatesClient } from "@/components/settings/OrgTemplatesClient";

export const dynamic = "force-dynamic";

export default function OrgTemplatesSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Алба · ХШ хуудас холбох"
        subtitle="Алба, хэлтэс бүрт холбогдох ХШ хуудсыг хувиарлана. Нэгжийн удирдлага / Ахлах мэргэжилтэн эдгээр холболтоор зөвхөн харах эрхтэй."
      />
      <OrgTemplatesClient />
    </div>
  );
}
