"use client";

import { AppSidebar, MobileChrome } from "@/components/layout/AppSidebar";

export function ShellFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden">
      <AppSidebar />
      <MobileChrome>{children}</MobileChrome>
    </div>
  );
}
