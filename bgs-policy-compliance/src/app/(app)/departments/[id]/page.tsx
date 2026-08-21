import { redirect } from "next/navigation";

export default async function DepartmentDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Legacy dept key → try treat as heltes bteg id
  redirect(`/org/heltes/${encodeURIComponent(decodeURIComponent(id))}`);
}
