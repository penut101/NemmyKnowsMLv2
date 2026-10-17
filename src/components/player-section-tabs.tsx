"use client";

import { usePathname } from "next/navigation";
import { NavigationLink as Link } from "@/components/navigation-link";
import { cn } from "@/lib/utils";

// The player pages under one Players nav entry. Links rather than a tablist:
// each is its own route with its own data and metadata.
export const CFB_PLAYER_SECTIONS = [
  { href: "/cfb/players", label: "Grades" },
  { href: "/cfb/heisman", label: "Heisman" },
  { href: "/cfb/draft", label: "Draft" },
] as const;
export const NFL_PLAYER_SECTIONS = [
  { href: "/nfl/players", label: "Grades" },
  { href: "/nfl/awards", label: "Awards" },
] as const;

export function PlayerSectionTabs({
  sections = CFB_PLAYER_SECTIONS,
  className,
}: {
  sections?: readonly { href: string; label: string }[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Player pages"
      className={cn("flex flex-wrap items-center font-mono text-xs uppercase tracking-wider", className)}
    >
      {sections.map((section) => {
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
