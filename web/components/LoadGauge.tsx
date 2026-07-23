"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

export function LoadGauge({ value, chartHeight = 90 }: { value: number | null; chartHeight?: number }) {
  const pct = value === null ? null : Math.max(0, Math.min(100, value));
  const data = [{ name: "load", value: pct ?? 0 }];

  return (
    <div className="card p-4">
      <div className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
        Load %
      </div>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="100%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={data}>
            <defs>
              <linearGradient id="load-gauge-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--status-good)" />
                <stop offset="50%" stopColor="var(--ice)" />
                <stop offset="100%" stopColor="var(--status-critical)" />
              </linearGradient>
            </defs>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: "var(--gridline)" }}
              dataKey="value"
              cornerRadius={7}
              fill="url(#load-gauge-gradient)"
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-2xl font-semibold text-center" style={{ color: "var(--text-primary)", marginTop: -8 }}>
        {pct === null ? "—" : `${Math.round(pct)}%`}
      </div>
    </div>
  );
}
