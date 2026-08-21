import {
  AppSidebar,
  MobileChrome,
} from "@/components/layout/AppSidebar";
import { getInspectionScope } from "@/lib/access/scope";

export async function ShellFrame({ children }: { children: React.ReactNode }) {
  const scope = await getInspectionScope();
  const unitMode = scope?.mode === "unit";
  const unitLabel = scope?.albaName || scope?.heltesName || null;

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden">
      <AppSidebar unitMode={unitMode} unitLabel={unitLabel} />
      <MobileChrome unitMode={unitMode}>{children}</MobileChrome>
    </div>
  );
}
