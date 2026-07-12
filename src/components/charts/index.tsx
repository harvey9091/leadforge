"use client";

/**
 * Chart components — thin wrappers around Recharts with the Leadforge
 * design language applied. Every chart inherits the muted palette and
 * minimal chrome (no gridlines by default, soft axes, thin lines).
 */

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { formatNumber } from "@/lib/utils";

const AXIS_COLOR = "oklch(0.62 0.008 264)";
const GRID_COLOR = "oklch(1 0 0 / 0.04)";

const CHART_COLORS = [
  "oklch(0.7 0.13 160)", // success green
  "oklch(0.72 0.14 75)", // warning amber
  "oklch(0.62 0.18 25)", // destructive red
  "oklch(0.68 0.1 220)", // info blue
  "oklch(0.6 0.12 290)", // purple
];

interface ChartTooltipProps extends TooltipProps<number, string> {
  labelFormatter?: (label: unknown) => string;
  valueFormatter?: (value: number) => string;
}

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = (v) => formatNumber(v),
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-popover/95 backdrop-blur-md px-3 py-2 text-[12px] shadow-premium-lg">
      {label !== undefined && (
        <div className="text-muted-foreground mb-1 text-[11px]">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      )}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-sm"
              style={{ background: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground tabular-nums">
              {valueFormatter(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Area chart — for trend lines                                              */
/* -------------------------------------------------------------------------- */

interface TrendChartProps {
  data: Array<{ date: string; value: number }>;
  color?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
}

export function TrendChart({
  data,
  color = CHART_COLORS[0],
  height = 200,
  valueFormatter,
}: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey="date"
          stroke={AXIS_COLOR}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis
          stroke={AXIS_COLOR}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
        />
        <Tooltip
          content={<ChartTooltip valueFormatter={valueFormatter} />}
          cursor={{ stroke: "oklch(1 0 0 / 0.08)", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.75}
          fill="url(#trendGrad)"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------------------- */
/*  Bar chart — for distribution                                              */
/* -------------------------------------------------------------------------- */

interface BarsChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
  layout?: "horizontal" | "vertical";
  valueFormatter?: (v: number) => string;
}

export function BarsChart({
  data,
  color = CHART_COLORS[0],
  height = 200,
  layout = "horizontal",
  valueFormatter,
}: BarsChartProps) {
  const isVertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={layout}
        margin={{ top: 6, right: 4, bottom: 0, left: isVertical ? 0 : -20 }}
      >
        <CartesianGrid
          stroke={GRID_COLOR}
          horizontal={!isVertical}
          vertical={isVertical}
        />
        {isVertical ? (
          <>
            <XAxis
              type="number"
              stroke={AXIS_COLOR}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              type="category"
              dataKey="label"
              stroke={AXIS_COLOR}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={110}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              stroke={AXIS_COLOR}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              stroke={AXIS_COLOR}
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={36}
            />
          </>
        )}
        <Tooltip
          content={<ChartTooltip valueFormatter={valueFormatter} />}
          cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
        />
        <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------------------- */
/*  Donut chart — for distributions                                           */
/* -------------------------------------------------------------------------- */

interface DonutChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
  valueFormatter?: (v: number) => string;
}

export function DonutChart({
  data,
  height = 200,
  valueFormatter,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="62%"
            outerRadius="100%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={<ChartTooltip valueFormatter={valueFormatter} />}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-[12px]">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="flex-1 text-muted-foreground truncate">{d.label}</span>
            <span className="font-medium text-foreground tabular-nums">
              {formatNumber(d.value)}
            </span>
            <span className="text-muted-foreground text-[11px] tabular-nums w-10 text-right">
              {((d.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sparkline — for inline trend in table cells                              */
/* -------------------------------------------------------------------------- */

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({
  data,
  color = CHART_COLORS[0],
  width = 80,
  height = 24,
}: SparklineProps) {
  const chartData = data.map((value, i) => ({ i, value }));
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
