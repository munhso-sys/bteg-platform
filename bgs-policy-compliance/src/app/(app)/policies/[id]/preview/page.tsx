import { notFound } from "next/navigation";
import { ContextBackLink } from "@/components/policies/policy-back-link";
import { PoliciesSubnav } from "@/components/policies/policies-subnav";
import { PolicyDocumentPreview } from "@/components/policies/policy-document-preview";
import { PolicyDocumentToolbar } from "@/components/policies/policy-document-toolbar";
import { PageHeader } from "@/components/ui/primitives";
import { getPolicyDetail } from "@/lib/db/repository";
import { buildPolicyDocumentModel } from "@/lib/policy-document";

export const dynamic = "force-dynamic";

export default async function PolicyPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPolicyDetail(id);
  if (!detail) notFound();

  const model = buildPolicyDocumentModel(detail);

  return (
    <div>
      <PoliciesSubnav />
      <div className="mb-2">
        <ContextBackLink
          fallbackHref="/policies/review"
          fallbackLabel="Шалгах жагсаалт"
        />
      </div>
      <PageHeader
        title={detail.policy.name}
        description="Бүрэн эхийн үзэлт · хэсгээр collapse · Word / PDF албан ёсны формат"
        actions={
          <PolicyDocumentToolbar
            policyId={detail.policy.id}
            policyName={detail.policy.name}
          />
        }
      />
      <PolicyDocumentPreview model={model} />
    </div>
  );
}
