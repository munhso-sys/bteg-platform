"use client";

import { useState } from "react";
import {
  AppSidebar,
  MobileChrome,
} from "@/components/layout/AppSidebar";

/** Client shell so banner Menu and desktop rail share pin/expand state. */
export function SidebarShell({
  unitMode = false,
  unitLabel = null,
  children,
}: {
  unitMode?: boolean;
  unitLabel?: string | null;
  children: React.ReactNode;
}) {
  const [pinned, setPinned] = useState(false);

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden">
      <AppSidebar
        unitMode={unitMode}
        unitLabel={unitLabel}
        pinned={pinned}
        onPinnedChange={setPinned}
      />
      <MobileChrome
        unitMode={unitMode}
        pinned={pinned}
        onTogglePin={() => setPinned((v) => !v)}
      >
        {children}
      </MobileChrome>
    </div>
  );
}
