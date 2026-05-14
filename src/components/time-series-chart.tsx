"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/timeseries";

const fmtMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmtShortDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function ClicksChart({ data, height = 220 }: { data: DailyPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtShortDate}
          tick={{ fontSize: 11, fill: "#64748b" }}
          stroke="#cbd5e1"
        />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} stroke="#cbd5e1" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          labelFormatter={(v) => fmtShortDate(String(v))}
        />
        <Area
          type="monotone"
          dataKey="humanClicks"
          name="Human"
          stackId="1"
          stroke="#4f46e5"
          fill="#a5b4fc"
          fillOpacity={0.7}
        />
        <Area
          type="monotone"
          dataKey="botClicks"
          name="Bot"
          stackId="1"
          stroke="#f43f5e"
          fill="#fda4af"
          fillOpacity={0.5}
        />
        <Line
          type="monotone"
          dataKey="conversions"
          name="Conv."
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={{ r: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data, height = 220 }: { data: DailyPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtShortDate}
          tick={{ fontSize: 11, fill: "#64748b" }}
          stroke="#cbd5e1"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          stroke="#cbd5e1"
          tickFormatter={(v) => fmtMoney(Number(v))}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          labelFormatter={(v) => fmtShortDate(String(v))}
          formatter={(v) => fmtMoney(Number(v))}
        />
        <Bar dataKey="revenueCents" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
        <Bar dataKey="commissionCents" name="Commission" fill="#34d399" radius={[3, 3, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
