"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartTone = {
  grid: string;
  tick: string;
  series: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipFg: string;
};

function useChartTone(): ChartTone {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  if (dark) {
    return {
      grid: "#334155",
      tick: "#cbd5e1",
      series: "#fbbf24",
      tooltipBg: "#1f2937",
      tooltipBorder: "#475569",
      tooltipFg: "#f1f5f9",
    };
  }
  return {
    grid: "#e2e8f0",
    tick: "#475569",
    series: "#0f172a",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
    tooltipFg: "#0f172a",
  };
}

export function ResponsibilityBarChart({
  data,
}: {
  data: Array<{ name: string; avg: number; count: number }>;
}) {
  const tone = useChartTone();
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={tone.grid} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: tone.tick }}
            stroke={tone.grid}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: tone.tick }}
            stroke={tone.grid}
          />
          <Tooltip
            contentStyle={{
              background: tone.tooltipBg,
              border: `1px solid ${tone.tooltipBorder}`,
              color: tone.tooltipFg,
              borderRadius: 6,
            }}
            labelStyle={{ color: tone.tooltipFg }}
          />
          <Bar
            dataKey="avg"
            name="Дундаж"
            fill={tone.series}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScoreTrendChart({
  data,
}: {
  data: Array<{ at: string; score: number }>;
}) {
  const tone = useChartTone();
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={tone.grid} />
          <XAxis
            dataKey="at"
            tick={{ fontSize: 11, fill: tone.tick }}
            stroke={tone.grid}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: tone.tick }}
            stroke={tone.grid}
          />
          <Tooltip
            contentStyle={{
              background: tone.tooltipBg,
              border: `1px solid ${tone.tooltipBorder}`,
              color: tone.tooltipFg,
              borderRadius: 6,
            }}
            labelStyle={{ color: tone.tooltipFg }}
          />
          <Line
            type="monotone"
            dataKey="score"
            name="Оноо"
            stroke={tone.series}
            strokeWidth={2}
            dot
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
