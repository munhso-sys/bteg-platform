import type { ReactNode } from "react";
import { Suspense } from "react";

export const metadata = {
  title: "SmartMine",
  description: "Боловсруулалт, тоног төхөөрөмж, засвар, Reason Tool",
};

export default function SmartMineLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-[var(--muted)]">SmartMine ачаалж байна…</div>
      }
    >
      {children}
    </Suspense>
  );
}
