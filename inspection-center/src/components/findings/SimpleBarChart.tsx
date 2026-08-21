type ChartSeries = {
  key: string;
  label: string;
  color: string;
};

export type ChartRow = {
  key: string;
  label: string;
  values: Record<string, number>;
};

export function SimpleBarChart({
  rows,
  series,
  emptyMessage = "Өгөгдөл алга",
}: {
  rows: ChartRow[];
  series: ChartSeries[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-sm text-[var(--muted)] sm:h-24">
        {emptyMessage}
      </div>
    );
  }

  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => series.map((item) => row.values[item.key] ?? 0)),
  );

  return (
    <div className="@container min-w-0 w-full space-y-2">
      {series.length > 1 ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)] @lg:text-xs">
          {series.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2.5 rounded-sm @lg:h-2.5 @lg:w-3"
                style={{ background: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <div
          className="flex w-full min-w-fit items-stretch gap-1.5 px-0.5 @sm:gap-2 @lg:gap-3 @3xl:gap-4"
          role="img"
          aria-label="Баганан график"
        >
          {rows.map((row) => {
            const tip = [
              row.label,
              ...series.map(
                (item) => `${item.label}: ${row.values[item.key] ?? 0}`,
              ),
            ].join(" · ");
            return (
              <div
                key={row.key}
                title={tip}
                className="flex min-w-[3.25rem] max-w-[7rem] flex-1 flex-col items-center @sm:min-w-[3.75rem] @lg:min-w-[4.5rem] @lg:max-w-[8.5rem] @3xl:min-w-[5rem] @3xl:max-w-[9.5rem]"
              >
                <div className="relative flex h-[6.75rem] w-full items-end justify-center gap-0.5 border-b border-[var(--border)] pt-3.5 @sm:h-28 @lg:h-32 @lg:gap-1 @lg:pt-4 @3xl:h-36">
                  <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--border)]/80" />
                  {series.map((item) => {
                    const value = row.values[item.key] ?? 0;
                    const pct = (value / maxValue) * 100;
                    return (
                      <div
                        key={item.key}
                        className="relative flex h-full w-full max-w-[0.9rem] flex-1 flex-col justify-end @sm:max-w-[1.1rem] @lg:max-w-[1.4rem] @3xl:max-w-[1.7rem]"
                      >
                        {value > 0 ? (
                          <span className="absolute bottom-full left-1/2 z-[1] mb-0.5 -translate-x-1/2 text-[9px] font-semibold tabular-nums leading-none text-[var(--fg)] @lg:text-[10px]">
                            {value}
                          </span>
                        ) : null}
                        <div
                          className="w-full rounded-t-[3px]"
                          style={{
                            height: `${value > 0 ? Math.max(pct, 3) : 0}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <span className="mt-1.5 line-clamp-2 h-7 w-full text-center text-[9px] leading-tight text-[var(--muted)] @sm:h-8 @sm:text-[10px] @lg:text-[11px]">
                  {row.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
