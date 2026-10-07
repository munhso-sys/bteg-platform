import type { ReactNode } from "react";
import { assertPortalMenuAccess } from "@/lib/rbac/assert-menu-access";

export default async function EmployeeVoiceLayout({
  children,
}: {
  children: ReactNode;
}) {
  await assertPortalMenuAccess("employee-voice");
  return children;
}
