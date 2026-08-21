import { formatNumber } from "@/lib/smartmine/numbers";
import type { ProcessingSummary } from "@/lib/smartmine/types";

const CATEGORY_LABEL: Record<
  ProcessingSummary["equipment"][number]["category"],
  string
> = {
  Dump: "Dump truck",
  Exca: "Excavator",
  Loader: "Loader",
  Bulldozer: "Bulldozer",
};

function dash(value: number | null, digits = 0) {
  if (value == null) return "—";
  return formatNumber(value, digits);
}

function SummaryPair({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-1 py-0.5">
      <span className="min-w-0 truncate text-[10px] text-[var(--muted)]">
        {label}
      </span>
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--fg)]">
        {value}
        <span className="ml-0.5 text-[10px] font-normal text-[var(--muted)]">
          {unit}
        </span>
      </span>
    </div>
  );
}

export function ProcessingSummaryPanel({
  summary,
}: {
  summary: ProcessingSummary | null;
}) {
  const equipment = summary?.equipment ?? [];
  const plants = summary?.plants ?? [];
  const equipmentAvailable = summary?.equipmentAvailable === true;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card)]">
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2">
        <h2 className="text-sm font-semibold leading-tight">
          Олборлолт / Үйлдвэрийн хураангуй
        </h2>
        <p className="text-[11px] text-[var(--muted)]">
          Ore feed · concentrate · техник
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2">
        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Олборлолтод ажилласан техник
        </h3>
        {equipmentAvailable ? (
          <div className="mb-0.5 grid grid-cols-[minmax(0,1fr)_2.25rem_3.5rem] gap-x-2 text-[10px] text-[var(--muted)]">
            <span />
            <span className="text-right">тоо</span>
            <span className="text-right">цаг</span>
          </div>
        ) : null}
        {equipment.map((row) => (
          <div
            key={row.category}
            className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] py-1"
          >
            <span className="min-w-0 truncate text-[11px] text-[var(--muted)]">
              {CATEGORY_LABEL[row.category]}
            </span>
            {equipmentAvailable ? (
              <span className="grid shrink-0 grid-cols-[2.25rem_3.5rem] gap-x-2 text-[12px] font-medium tabular-nums text-[var(--fg)]">
                <span className="text-right">{dash(row.count)}</span>
                <span className="text-right">
                  {dash(row.operatedHours, 2)}
                </span>
              </span>
            ) : (
              <span className="shrink-0 text-[12px] tabular-nums text-[var(--muted)]">
                —
              </span>
            )}
          </div>
        ))}
        {equipmentAvailable ? (
          <>
            <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] py-1">
              <span className="min-w-0 truncate text-[11px] text-[var(--muted)]">
                Нийт ажилласан цаг
              </span>
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--fg)]">
                {dash(summary?.totalOperatedHours ?? null, 2)}
                <span className="ml-0.5 text-[10px] font-normal text-[var(--muted)]">
                  цаг
                </span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-1">
              <span className="min-w-0 truncate text-[11px] text-[var(--muted)]">
                Дундаж цаг / техник
              </span>
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--fg)]">
                {dash(summary?.avgOperatedHoursPerActive ?? null, 2)}
                <span className="ml-0.5 text-[10px] font-normal text-[var(--muted)]">
                  цаг
                </span>
              </span>
            </div>
          </>
        ) : (
          <p className="mt-1.5 text-[10px] leading-snug text-[var(--muted)]">
            {summary?.missingEquipmentSource
              ? "Техникийн ажиллагааны view-ээс өгөгдөл уншигдсангүй."
              : "Сонгосон хугацаанд техникийн ажиллагааны мөр алга."}
          </p>
        )}
        <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">
          Cycle time-аас тооцсон идэвхтэй цаг.
        </p>

        <h3 className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          Баяжуулах үйлдвэрийн мэдээ
        </h3>
        {plants.length === 0 ? (
          <p className="py-2 text-[11px] text-[var(--muted)]">
            Сонгосон хугацаанд үйлдвэрийн мөр алга.
          </p>
        ) : (
          plants.map((plant) => (
            <div
              key={plant.name}
              className="border-b border-[var(--border)] py-1.5 last:border-b-0"
            >
              <div
                className="truncate text-[11px] font-medium text-[var(--fg)]"
                title={plant.name}
              >
                {plant.name}
              </div>
              <div className="mt-0.5 grid grid-cols-2 gap-x-3">
                <SummaryPair
                  label="Ore feed"
                  value={formatNumber(plant.oreFeedTonnes, 1)}
                  unit="т"
                />
                <SummaryPair
                  label="Concentrate"
                  value={formatNumber(plant.concentrateTonnes, 1)}
                  unit="т"
                />
                <SummaryPair
                  label="Recovery"
                  value={formatNumber(plant.recoveryPct, 1)}
                  unit="%"
                />
                <SummaryPair
                  label="Өдөр"
                  value={formatNumber(plant.activeDays)}
                  unit="өдөр"
                />
              </div>
            </div>
          ))
        )}
      </div>

      <p className="shrink-0 border-t border-[var(--border)] px-3 py-1.5 text-[10px] text-[var(--muted)]">
        сонгосон хугацааны хураангуй
      </p>
    </section>
  );
}
