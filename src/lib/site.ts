export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const SITE_NAME = "NemmyKnowsMLv2";
export const SITE_DESCRIPTION =
  "Player grades, team ratings, and statistical analysis across MLB, college football, the NFL, and the NHL. Explore player talent and matchups for sports, fantasy, and DFS research.";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";
export const TWITTER_HANDLE = process.env.NEXT_PUBLIC_TWITTER_HANDLE || undefined;
export const SOCIAL_LINKS = [
  { label: "GitHub", value: "github.com/penut101/NemmyKnowsMLv2", href: "https://github.com/penut101/NemmyKnowsMLv2" },
] as const;

export const SPORT_HOME = {
  mlb: "/mlb/players",
  cfb: "/cfb/ratings",
  nfl: "/nfl/ratings",
  nhl: "/nhl/ratings",
} as const;
