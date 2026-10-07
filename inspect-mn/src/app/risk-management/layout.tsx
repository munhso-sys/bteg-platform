import type { ReactNode } from "react";
import { assertPortalMenuAccess } from "@/lib/rbac/assert-menu-access";

export const metadata = {
  title: "Эрсдэлийн удирдлага",
  description: "Эрсдэлийн бүртгэл, матриц, засвар, эх үүсвэр, хавтас",
};

export default async function RiskManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  await assertPortalMenuAccess("risk-management");
  return children;
}
