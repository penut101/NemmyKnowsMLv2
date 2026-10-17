import type { ReactNode } from "react";
import { SITE_TIME_LABEL } from "@/lib/site-time";

export function LocalKickoffs({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Times shown in {SITE_TIME_LABEL}.
      </p>
      <div>{children}</div>
    </div>
  );
}
