import { SidebarShell } from "@/components/layout/SidebarShell";
import { InspectionNavProvider } from "@/lib/access/InspectionNavContext";
import { getInspectionScope } from "@/lib/access/scope";

export async function ShellFrame({ children }: { children: React.ReactNode }) {
  const scope = await getInspectionScope();
  const unitMode = scope?.mode === "unit";
  const unitLabel = scope?.albaName || scope?.heltesName || null;
  const menus = Array.isArray(scope?.menus) ? scope.menus : null;
  const submenus =
    scope?.submenus && typeof scope.submenus === "object"
      ? scope.submenus
      : null;

  return (
    <InspectionNavProvider value={{ menus, submenus }}>
      <SidebarShell unitMode={unitMode} unitLabel={unitLabel}>
        {children}
      </SidebarShell>
    </InspectionNavProvider>
  );
}
