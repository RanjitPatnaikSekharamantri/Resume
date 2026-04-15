"use client";

import * as React from "react";
import { type TooltipProps } from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label: string;
    color: string;
  }
>;

const ChartContext = React.createContext<ChartConfig | undefined>(undefined);

export function ChartContainer({
  config,
  className,
  children,
}: React.PropsWithChildren<{
  config: ChartConfig;
  className?: string;
}>) {
  return (
    <ChartContext.Provider value={config}>
      <div className={cn("h-[300px] w-full text-xs", className)}>{children}</div>
    </ChartContext.Provider>
  );
}

type TooltipPayload = {
  value?: number | string;
  dataKey?: string;
  name?: string;
  color?: string;
  payload?: Record<string, unknown>;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  const config = React.useContext(ChartContext);
  if (!active || !payload?.length || !config) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
      {label ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          {String(label)}
        </p>
      ) : null}
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const item = entry as TooltipPayload;
          const key = String(item.dataKey ?? item.name ?? "");
          const meta = config[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color ?? meta?.color ?? "#2563EB" }}
                />
                <span className="text-xs text-zinc-600">{meta?.label ?? key}</span>
              </div>
              <span className="text-xs font-semibold text-zinc-900">
                {String(item.value ?? "-")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
