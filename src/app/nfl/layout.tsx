import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "NFL Ratings & Player Grades",
  description:
    "NFL team ratings, player grades, projected production, and position-specific comparisons for statistical analysis and fantasy research.",
};

const nflLinks = [
  { href: "/nfl/ratings", label: "Ratings" },
  { href: "/nfl/players", label: "Players", match: ["/nfl/players", "/nfl/awards"] },
  { href: "/nfl/predictions", label: "Predictions" },
  { href: "/nfl/schedule", label: "Schedule" },
  { href: "/nfl/season-wins", label: "Season Wins" },
  { href: "/nfl/playoffs", label: "Playoffs" },
  { href: "/nfl/history", label: "History" },
  { href: "/nfl/performance", label: "Performance" },
  { href: "/nfl/methodology", label: "Methodology" },
];

export default function NflLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Nav links={nflLinks} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
