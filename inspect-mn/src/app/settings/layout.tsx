import type { ReactNode } from "react";
import { assertPortalMenuAccess } from "@/lib/rbac/assert-menu-access";

/** Settings segment layout — profile is open to all users; admin pages self-guard. */
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Admin bypass inside assert; other roles respect Role эрх → settings menus.
  await assertPortalMenuAccess("settings");
  return children;
}
