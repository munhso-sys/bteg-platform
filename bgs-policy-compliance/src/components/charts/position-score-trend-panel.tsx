"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  SCORE_TREND_SERIES,
  type ScoreSnapshot,
  type ScoreTrendPoint,
} from "@/lib/score-trend";
import { RESPONSIBILITY_SHORT } from "@/lib/constants";
import type { ResponsibilityType } from "@/lib/types";

function formatScore(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function SnapshotChip({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0 rounded border border-slate-200 bg-white px-2.5 py-2 dark:border-[var(--border)] dark:bg-[var(--card)]">
      <div className="flex items-center gap-1.5">
        {accent ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden
          />
        ) : null}
        <div className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </div>
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-[var(--fg)]">
        {value}
      </div>
      {hint ? (
        <div className="truncate text-[10px] text-slate-500">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function PositionScoreTrendPanel({
  points,
  snapshot,
}: {
  points: ScoreTrendPoint[];
  snapshot: ScoreSnapshot;
}) {
  const activeSeries = useMemo(() => {
    return SCORE_TREND_SERIES.filter((s) =>
      points.some((p) => {
        const v = p[s.key];
        return v != null && Number.isFinite(v);
      }),
    );
  }, [points]);

  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Үнэлгээ байхгүй. Журмын үнэлгээ эсвэл АБТ Т-үнэлгээ хийсний дараа
        хандлага энд харагдана.
      </p>
    );
  }

  const typeOrder: ResponsibilityType[] = [
    "IMPLEMENTATION",
    "MONITORING",
    "VERIFICATION",
    "DEPLOYMENT",
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <SnapshotChip
          label="Ж-үнэлгээ"
          value={formatScore(snapshot.j_avg)}
          hint={
            snapshot.j_count
              ? `${snapshot.j_count} үнэлгээ · ${snapshot.j_period ?? ""}`
              : "Журмын дундаж"
          }
          accent="#0f172a"
        />
        {typeOrder.map((t) => {
          const series = SCORE_TREND_SERIES.find(
            (s) =>
              s.key ===
              (t === "IMPLEMENTATION"
                ? "implementation"
                : t === "MONITORING"
                  ? "monitoring"
                  : t === "VERIFICATION"
                    ? "verification"
                    : "deployment"),
          );
          const n = snapshot.typeCounts[t] ?? 0;
          return (
            <SnapshotChip
              key={t}
              label={RESPONSIBILITY_SHORT[t]}
              value={formatScore(snapshot.byType[t])}
              hint={n ? `${n} үнэлгээ` : "Үнэлгээгүй"}
              accent={series?.color}
            />
          );
        })}
        <SnapshotChip
          label="Т-үнэлгээ"
          value={formatScore(snapshot.t_score)}
          hint={snapshot.t_period ? `АБТ · ${snapshot.t_period}` : "АБТ үнэлгээ"}
          accent="#e11d48"
        />
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Үе бүрийн эцэст (cumulative) дундаж:{" "}
        <span className="font-medium text-slate-700">Ж</span> = журмын
        холбоосын сүүлийн үнэлгээний дундаж; өнгөт шугамууд = үүргийн төрлөөр;{" "}
        <span className="font-medium text-rose-700">Т</span> = АБТ үнэлгээ.
      </p>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="h-56 min-w-[20rem] w-full sm:h-64 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 10, fill: "#475569" }}
                stroke="#e2e8f0"
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#475569" }}
                stroke="#e2e8f0"
                width={28}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value, name) => {
                  const n =
                    typeof value === "number"
                      ? formatScore(value)
                      : value == null
                        ? "—"
                        : String(value);
                  return [n, String(name)];
                }}
                labelFormatter={(label) => `Үе: ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="line"
              />
              {activeSeries.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={s.strokeWidth}
                  strokeDasharray={s.dashed ? "6 4" : undefined}
                  dot={{ r: 2.5, strokeWidth: 1 }}
                  connectNulls
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
