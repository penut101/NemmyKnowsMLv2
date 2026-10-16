"use client";

import { InfoTip } from "@/components/info-tip";

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  tooltip?: string;
}

export function KpiCard({ label, value, sub, tooltip }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
        {label}
        {tooltip && <InfoTip text={tooltip} />}
      </span>
      <span className="font-mono font-bold tabular-nums text-base">
        {value}
      </span>
      {sub && (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {sub}
        </span>
      )}
    </div>
  );
}
