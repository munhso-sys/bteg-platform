import { SidebarShell } from "@/components/layout/SidebarShell";
import { getInspectionScope } from "@/lib/access/scope";

export async function ShellFrame({ children }: { children: React.ReactNode }) {
  const scope = await getInspectionScope();
  const unitMode = scope?.mode === "unit";
  const unitLabel = scope?.albaName || scope?.heltesName || null;

  return (
    <SidebarShell unitMode={unitMode} unitLabel={unitLabel}>
      {children}
    </SidebarShell>
  );
}
