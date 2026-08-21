"use client";

import { cn } from "@/lib/cn";
import { matrixTone } from "@/components/reports/reportLabels";

export function ReportMatrix({
  cells,
}: {
  cells: { likelihood: number; impact: number; count: number }[];
}) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-1">
        {cells.map((cell) => (
          <div
            key={`${cell.impact}-${cell.likelihood}`}
            title={`Нөлөө ${cell.impact} × магадлал ${cell.likelihood}`}
            className={cn(
              "flex h-9 items-center justify-center rounded border text-xs font-semibold tabular-nums",
              matrixTone(cell.likelihood, cell.impact, cell.count),
            )}
          >
            {cell.count || "·"}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Баруун дээд — өндөр нөлөө / өндөр магадлал
      </p>
    </div>
  );
}
