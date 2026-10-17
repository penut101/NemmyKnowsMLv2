"use client";

import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

// A small circled "i" that opens a one-paragraph explanation on click and
// closes on an outside pointer or Escape. Shared by the KPI cards and the
// player grade cards so every metric on the site explains itself the same way.
export function InfoTip({
  text,
  label,
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex", className)}>
      <Popover.Root>
        <Popover.Trigger
          aria-label={label ?? text}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/40 font-serif text-[9px] italic leading-none text-muted-foreground/70 cursor-pointer select-none hover:border-foreground/60 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/60"
        >
          i
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            side="bottom"
            sideOffset={6}
            collisionPadding={8}
            collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}
            className="z-50 data-[anchor-hidden]:invisible"
          >
            <Popover.Popup
              aria-label={label ?? text}
              onClick={(e) => e.stopPropagation()}
              className="w-64 max-w-[min(var(--available-width),calc(100vw-1rem))] max-h-[var(--available-height)] overflow-y-auto rounded-md border border-border bg-popover px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal whitespace-normal text-popover-foreground shadow-md outline-none [overflow-wrap:anywhere]"
            >
              <Popover.Description>{text}</Popover.Description>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}
