"use client";

import { usePathname } from "next/navigation";
import { NavigationLink as Link } from "@/components/navigation-link";
import { HeaderDate } from "@/components/header-date";
import { ThemeToggle } from "@/components/theme-toggle";
import { MomentumWordmark } from "@/components/momentum-wordmark";
import { SPORT_HOME } from "@/lib/site";

const links = [
  { href: SPORT_HOME.mlb, label: "MLB" },
  { href: SPORT_HOME.cfb, label: "CFB" },
  { href: SPORT_HOME.nfl, label: "NFL" },
  { href: SPORT_HOME.nhl, label: "NHL" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="site-masthead relative z-10">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-3 px-page-gutter pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4">
        <div className="flex shrink-0 items-center justify-between gap-5">
          <Link href="/" aria-label="Momentum home" className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4">
            <MomentumWordmark />
          </Link>
          <div className="sm:hidden"><ThemeToggle /></div>
        </div>
        <nav
          aria-label="Primary"
          className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2"
        >
          {links.map((link) => {
            const active = pathname.startsWith(`/${link.href.split("/")[1]}`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "true" : undefined}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${active ? "border-current" : "border-transparent opacity-75 hover:opacity-100"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden shrink-0 items-center gap-4 sm:flex">
          <div className="hidden lg:block"><HeaderDate /></div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
