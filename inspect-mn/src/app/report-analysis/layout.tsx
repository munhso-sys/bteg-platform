import type { ReactNode } from "react";
import { assertPortalMenuAccess } from "@/lib/rbac/assert-menu-access";

export const metadata = {
  title: "Тайлан шинжилгээ",
  description: "ДХШХ-ийн үйл ажиллагааны нэгдсэн удирдлага",
};

export default async function ReportAnalysisLayout({
  children,
}: {
  children: ReactNode;
}) {
  await assertPortalMenuAccess("report-analysis");
  return children;
}
