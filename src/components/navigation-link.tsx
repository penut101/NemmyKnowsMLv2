"use client";

import Link, { useLinkStatus } from "next/link";
import { useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

function NavigationContent({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return <>
    <span className={pending ? "opacity-50" : undefined}>{children}</span>
    <span role="status" className="sr-only">{pending ? "Loading page" : ""}</span>
  </>;
}

// Visible menus otherwise prefetch every sport, regenerating stale destinations
// even when the visitor never opens them. Keep Next's prefetch once intent is clear.
export function IntentLink({ prefetch, onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const [active, setActive] = useState(false);
  return <Link
    {...props}
    prefetch={prefetch === undefined ? (active ? null : false) : prefetch}
    onMouseEnter={(event) => { setActive(true); onMouseEnter?.(event); }}
    onFocus={(event) => { setActive(true); onFocus?.(event); }}
    onTouchStart={(event) => { setActive(true); onTouchStart?.(event); }}
  />;
}

export function NavigationLink({ children, className, ...props }: ComponentProps<typeof Link>) {
  // Contain the status label when a link lives inside a horizontal scroller.
  return <IntentLink className={cn("relative", className)} {...props}><NavigationContent>{children}</NavigationContent></IntentLink>;
}
