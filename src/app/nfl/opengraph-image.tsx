import { renderShareCard, SHARE_CARD_CONTENT_TYPE, SHARE_CARD_SIZE } from "@/components/share-card";

export const alt = "NFL player and team analysis | NemmyKnowsMLv2";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default function OpenGraphImage() {
  return renderShareCard({
    eyebrow: "NFL",
    title: "NFL Ratings & Grades",
    subtitle:
      "Team strength, player grades, projected production, and position-specific comparisons for deeper football analysis.",
    chips: ["Team ratings", "Player grades", "Projected production"],
  });
}
