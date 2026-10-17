"use client";

import { usePathname } from "next/navigation";
import { NavigationLink as Link } from "@/components/navigation-link";
import { cn } from "@/lib/utils";

// The three player pages under the one Players nav entry. Links rather than a
// tablist: each is its own route with its own data and metadata.
const SECTIONS = [
  { href: "/cfb/players", label: "Grades" },
  { href: "/cfb/heisman", label: "Heisman" },
  { href: "/cfb/draft", label: "Draft" },
] as const;

export function PlayerSectionTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Player pages"
      className={cn("flex flex-wrap items-center font-mono text-xs uppercase tracking-wider", className)}
    >
      {SECTIONS.map((section) => {
        const active = pathname.startsWith(section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-[var(--brand-highlight)] text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
