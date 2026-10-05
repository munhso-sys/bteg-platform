import { PageHeader } from "@/components/ui/primitives";
import { OrgStructureClient } from "./OrgStructureClient";

export const dynamic = "force-dynamic";

export default function OrgStructureSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Байгууллага · хэлтэс · алба"
        description="Нэгжийн бүтцийг нэмэх, хасах. Буруу нэмэгдсэн алба (жнь. «БҮГД»)-ыг эндээс устгана."
      />
      <OrgStructureClient />
    </div>
  );
}
