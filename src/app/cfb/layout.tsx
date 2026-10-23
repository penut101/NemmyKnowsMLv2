import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "College Football Ratings & Player Grades",
  description:
    "College football team ratings, position-specific player grades, offense and defense splits, player comparisons, and Heisman analysis.",
};

const cfbLinks = [
  { href: "/cfb/ratings", label: "Ratings" },
  { href: "/cfb/players", label: "Players", match: ["/cfb/players", "/cfb/heisman", "/cfb/draft"] },
  { href: "/cfb/predictions", label: "Predictions" },
  { href: "/cfb/schedule", label: "Schedule" },
  { href: "/cfb/playoffs", label: "Playoffs" },
  { href: "/cfb/history", label: "History" },
  { href: "/cfb/performance", label: "Performance" },
  { href: "/cfb/methodology", label: "Methodology" },
];

export default function CfbLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Nav links={cfbLinks} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
