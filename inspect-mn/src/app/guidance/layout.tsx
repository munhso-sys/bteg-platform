import type { ReactNode } from "react";
import { assertPortalMenuAccess } from "@/lib/rbac/assert-menu-access";

export default async function GuidanceLayout({
  children,
}: {
  children: ReactNode;
}) {
  await assertPortalMenuAccess("guidance");
  return children;
}
