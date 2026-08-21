import { Suspense } from "react";
import { FindingsSubnav } from "@/components/findings/FindingsSubnav";

export default function FindingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Suspense fallback={<div className="mb-4 h-10 border-b border-[var(--border)]" />}>
        <FindingsSubnav />
      </Suspense>
      {children}
    </div>
  );
}
