import type { ReactNode } from "react";
import { getPolicyScope, isPolicyAdmin } from "@/lib/access/scope";
import { SettingsSubnav } from "./SettingsSubnav";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const scope = await getPolicyScope();
  const showDataReset = isPolicyAdmin(scope);

  return (
    <div>
      <SettingsSubnav showDataReset={showDataReset} />
      {children}
    </div>
  );
}
