import { renderShareCard, SHARE_CARD_CONTENT_TYPE, SHARE_CARD_SIZE } from "@/components/share-card";

export const alt = "NemmyKnowsMLv2 | Sports Analytics";
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_CONTENT_TYPE;

export default function OpenGraphImage() {
  return renderShareCard({
    title: "NemmyKnowsMLv2",
    subtitle:
      "Player grades, team ratings, and statistical tools for sports analysis, fantasy, and DFS research.",
    chips: ["Player grades", "Team ratings", "NFL · CFB · MLB · NHL"],
  });
}
