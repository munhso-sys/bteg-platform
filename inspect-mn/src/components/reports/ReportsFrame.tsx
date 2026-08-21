"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportsNav } from "@/components/reports/ReportsNav";
import { usePlatformReport } from "@/components/reports/usePlatformReport";
import type { PlatformReport } from "@/lib/reports/types";

export function ReportsFrame({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: (ctx: {
    data: PlatformReport | null;
    loading: boolean;
    error: string;
    load: () => Promise<void>;
  }) => ReactNode;
}) {
  const { data, error, loading, load } = usePlatformReport();

  return (
    <div className="reports-print">
      <div className="print:hidden">
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
      <ReportsNav />
      </div>
      <div className="mb-4 hidden border-b border-black/20 pb-3 print:block">
        <div className="text-lg font-semibold">{data?.title ?? title}</div>
        <div className="mt-1 text-xs text-black/60">
          {data?.generatedAt
            ? new Date(data.generatedAt).toLocaleString("mn-MN")
            : ""}
        </div>
      </div>
      {error ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      ) : null}
      {data && Object.keys(data.sourceErrors).length > 0 ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 print:hidden">
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
