import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getPolicyScope } from "@/lib/access/scope";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const scope = await getPolicyScope();
  return (
    <AppShell
      mode={scope?.mode ?? "full"}
      positionId={scope?.positionId ?? null}
      positionName={scope?.positionName ?? null}
      heltesId={scope?.heltesId ?? null}
      albaId={scope?.albaId ?? null}
      heltesName={scope?.heltesName ?? null}
      albaName={scope?.albaName ?? null}
    >
      {children}
    </AppShell>
  );
}
