import { renderShareCard, SHARE_CARD_CONTENT_TYPE, SHARE_CARD_SIZE } from "@/components/share-card";

export const alt = "MLB player analysis | René Núñez";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default function OpenGraphImage() {
  return renderShareCard({
    eyebrow: "MLB",
    title: "MLB Player Analysis",
    subtitle:
      "Explore hitter and pitcher grades, skill profiles, projected production, and trade value.",
    chips: ["Player grades", "Skill profiles", "Projected production"],
  });
}
