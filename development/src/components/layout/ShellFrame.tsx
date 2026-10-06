"use client";

import { useState } from "react";
import { AppSidebar, MobileChrome } from "@/components/layout/AppSidebar";

export function ShellFrame({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState(false);

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden">
      <AppSidebar pinned={pinned} onPinnedChange={setPinned} />
      <MobileChrome
        pinned={pinned}
        onTogglePin={() => setPinned((v) => !v)}
      >
        {children}
      </MobileChrome>
    </div>
  );
}
