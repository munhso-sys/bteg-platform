import { Suspense } from "react";
import { ActionsSubnav } from "@/components/actions/ActionsSubnav";

export default function ActionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Suspense fallback={<div className="mb-4 h-10 border-b border-[var(--border)]" />}>
        <ActionsSubnav />
      </Suspense>
      {children}
    </div>
  );
}
