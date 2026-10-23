import { renderShareCard, SHARE_CARD_CONTENT_TYPE, SHARE_CARD_SIZE } from "@/components/share-card";

export const alt = "College football analysis | René Núñez";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default function OpenGraphImage() {
  return renderShareCard({
    eyebrow: "College football",
    title: "CFB Ratings & Grades",
    subtitle:
      "Compare Division 1 teams, explore position-specific player grades, and follow the Heisman race.",
    chips: ["Team ratings", "Player grades", "Heisman"],
  });
}
