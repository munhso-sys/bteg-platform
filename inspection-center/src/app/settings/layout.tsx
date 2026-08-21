import type { ReactNode } from "react";
import { SettingsSubnav } from "@/components/settings/SettingsSubnav";
import {
  getInspectionScope,
  isInspectionAdmin,
} from "@/lib/access/scope";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const scope = await getInspectionScope();
  const showDataReset = isInspectionAdmin(scope);

  return (
    <div>
      <SettingsSubnav showDataReset={showDataReset} />
      {children}
    </div>
  );
}
