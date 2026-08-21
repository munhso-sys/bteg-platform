"use client";

import { useMemo } from "react";

export type DualSeriesPoint = {
  date: string;
  left: number;
  right: number;
};

export type DualAxisSeries = {
  label: string;
  unit: string;
  color: string;
};

function niceNum(range: number, round: boolean) {
  const exp = Math.floor(Math.log10(Math.abs(range) || 1));
  const f = (Math.abs(range) || 1) / 10 ** exp;
  let nf: number;
  if (round) {
    if (f < 1.5) nf = 1;
    else if (f < 3) nf = 2;
    else if (f < 7) nf = 5;
    else nf = 10;
  } else if (f <= 1) nf = 1;
  else if (f <= 2) nf = 2;
  else if (f <= 5) nf = 5;
  else nf = 10;
  return nf * 10 ** exp;
}

function autoScale(values: number[], tickCount = 4) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (nums.length === 0) {
    return { min: 0, max: 1, ticks: [0, 0.5, 1] };
  }
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) {
    const pad = Math.abs(min) * 0.12 || 1;
    min -= pad;
    max += pad;
  } else {
    const span = max - min;
    min -= span * 0.08;
    max += span * 0.08;
  }
  const range = niceNum(max - min, false);
  const step = niceNum(range / Math.max(tickCount - 1, 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return {
    min: niceMin,
    max: niceMax === niceMin ? niceMin + step : niceMax,
    ticks,
  };
}

function fmt(value: number) {
  if (Math.abs(value) >= 100) {
    return value.toLocaleString("mn-MN", { maximumFractionDigits: 0 });
  }
  return value.toLocaleString("mn-MN", { maximumFractionDigits: 2 });
}

const CHART = {
  width: 880,
  height: 268,
  pad: { top: 16, right: 58, bottom: 30, left: 58 },
} as const;

export function DualAxisChart({
  points,
  left,
  right,
  compact = false,
}: {
  points: DualSeriesPoint[];
  left: DualAxisSeries;
  right: DualAxisSeries;
  compact?: boolean;
}) {
  const { width, height, pad } = CHART;

  const chart = useMemo(() => {
    const innerW = CHART.width - CHART.pad.left - CHART.pad.right;
    const innerH = CHART.height - CHART.pad.top - CHART.pad.bottom;
    const leftScale = autoScale(points.map((p) => p.left));
    const rightScale = autoScale(points.map((p) => p.right));
    const x = (index: number) =>
      CHART.pad.left +
      (points.length <= 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
    const yLeft = (value: number) =>
      CHART.pad.top +
      (1 - (value - leftScale.min) / (leftScale.max - leftScale.min || 1)) * innerH;
    const yRight = (value: number) =>
      CHART.pad.top +
      (1 - (value - rightScale.min) / (rightScale.max - rightScale.min || 1)) *
        innerH;
    return { leftScale, rightScale, x, yLeft, yRight, innerH };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
        Графикийн өгөгдөл алга
      </div>
    );
  }

  const leftPath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${chart.x(i).toFixed(1)} ${chart.yLeft(p.left).toFixed(1)}`,
    )
    .join(" ");
  const rightPath = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${chart.x(i).toFixed(1)} ${chart.yRight(p.right).toFixed(1)}`,
    )
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const showDots = points.length <= 48;
  const hitWidth = Math.max(6, (width - pad.left - pad.right) / points.length);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-[var(--fg)]">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ background: left.color }}
            />
            {left.label} · зүүн
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--fg)]">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ background: right.color }}
            />
            {right.label} · баруун
          </span>
        </div>
        <p className="text-[11px] text-[var(--muted)]">
          {first.date} → {last.date} · тусдаа авто-масштаб
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={
          compact
            ? "h-[180px] w-full sm:h-[210px] xl:h-[220px]"
            : "h-[200px] w-full sm:h-[240px] xl:h-[250px]"
        }
        role="img"
        aria-label={`${left.label} болон ${right.label} хос тэнхлэгт график`}
      >
        {chart.leftScale.ticks.map((tick) => (
          <line
            key={`grid-${tick}`}
            x1={pad.left}
            x2={width - pad.right}
            y1={chart.yLeft(tick)}
            y2={chart.yLeft(tick)}
            stroke="currentColor"
            className="text-[var(--border)]"
          />
        ))}
        {chart.leftScale.ticks.map((tick) => (
          <text
            key={`left-${tick}`}
            x={pad.left - 8}
            y={chart.yLeft(tick) + 3}
            textAnchor="end"
            fill={left.color}
            fontSize="11"
          >
            {fmt(tick)}
          </text>
        ))}
        {chart.rightScale.ticks.map((tick) => (
          <text
            key={`right-${tick}`}
            x={width - pad.right + 8}
            y={chart.yRight(tick) + 3}
            fill={right.color}
            fontSize="11"
          >
            {fmt(tick)}
          </text>
        ))}
        <text x={pad.left} y={12} fill={left.color} fontSize="10">
          {left.label} {left.unit}
        </text>
        <text
          x={width - pad.right}
          y={12}
          textAnchor="end"
          fill={right.color}
          fontSize="10"
        >
          {right.label} {right.unit}
        </text>
        <path
          d={rightPath}
          fill="none"
          stroke={right.color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={leftPath}
          fill="none"
          stroke={left.color}
          strokeWidth="2.3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {showDots
          ? points.map((p, i) => (
              <g key={`dot-${p.date}`}>
                <circle
                  cx={chart.x(i)}
                  cy={chart.yLeft(p.left)}
                  r="2.2"
                  fill={left.color}
                />
                <circle
                  cx={chart.x(i)}
                  cy={chart.yRight(p.right)}
                  r="2"
                  fill={right.color}
                />
              </g>
            ))
          : null}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.date}`}
            x={chart.x(i) - hitWidth / 2}
            y={pad.top}
            width={hitWidth}
            height={chart.innerH}
            fill="transparent"
          >
            <title>
              {`${p.date}\n${left.label}: ${fmt(p.left)} ${left.unit}\n${right.label}: ${fmt(p.right)} ${right.unit}`}
            </title>
          </rect>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={`x-${p.date}`}
              x={chart.x(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-[var(--muted)]"
              fontSize="10"
            >
              {p.date.slice(5)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
