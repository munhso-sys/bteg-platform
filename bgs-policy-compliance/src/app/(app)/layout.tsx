import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PolicyNavProvider } from "@/lib/access/PolicyNavContext";
import { getPolicyScope } from "@/lib/access/scope";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const scope = await getPolicyScope();
  const menus = Array.isArray(scope?.menus) ? scope.menus : null;
  const submenus =
    scope?.submenus && typeof scope.submenus === "object"
      ? scope.submenus
      : null;

  return (
    <PolicyNavProvider value={{ menus, submenus }}>
      <AppShell
        mode={scope?.mode ?? "full"}
        positionId={scope?.positionId ?? null}
        positionName={scope?.positionName ?? null}
        heltesId={scope?.heltesId ?? null}
        albaId={scope?.albaId ?? null}
        heltesName={scope?.heltesName ?? null}
        albaName={scope?.albaName ?? null}
        menus={menus}
        submenus={submenus}
      >
        {children}
      </AppShell>
    </PolicyNavProvider>
  );
}
