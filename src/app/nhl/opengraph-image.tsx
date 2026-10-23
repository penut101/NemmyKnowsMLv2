import { renderShareCard, SHARE_CARD_CONTENT_TYPE, SHARE_CARD_SIZE } from "@/components/share-card";

export const alt = "NHL team analysis | René Núñez";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default function OpenGraphImage() {
  return renderShareCard({
    eyebrow: "NHL",
    title: "NHL Team Analysis",
    subtitle:
      "Explore team strength through shot quality, expected goals, and attack and defense splits at home and on the road.",
    chips: ["Team ratings", "Expected goals", "Shot quality"],
  });
}
