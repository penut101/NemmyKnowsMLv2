"use client";

import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={cn("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={label ?? text}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/40 font-serif text-[9px] italic leading-none text-muted-foreground/70 cursor-pointer select-none hover:border-foreground/60 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-foreground/60"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-64 max-w-[80vw] -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-popover-foreground shadow-md"
        >
          {text}
        </span>
      )}
    </span>
  );
}
