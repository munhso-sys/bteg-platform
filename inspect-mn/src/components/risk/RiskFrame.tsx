"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { RiskNav } from "@/components/risk/RiskNav";
import { useRiskOverview } from "@/components/risk/useRiskOverview";
import type { RiskOverview } from "@/lib/risk/types";

export function RiskFrame({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: (ctx: {
    data: RiskOverview | null;
    loading: boolean;
    error: string;
    load: () => Promise<void>;
  }) => ReactNode;
}) {
  const { data, error, loading, load } = useRiskOverview();

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {actions}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Шинэчлэх
            </button>
          </>
        }
      />
      <RiskNav />
      {error ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      ) : null}
      {data && Object.keys(data.sourceErrors).length > 0 ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Зарим эх систем холбогдсонгүй:{" "}
          {Object.entries(data.sourceErrors)
            .map(([k, v]) => `${k} (${v})`)
            .join(" · ")}
        </div>
      ) : null}
      {children({ data, loading, error, load })}
    </div>
  );
}
