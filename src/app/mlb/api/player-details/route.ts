import { DETAIL_IDS, fetchPlayerDetails } from "@/lib/mlb-players";

// Outlook, tip components, and trait rows for up to forty players: the ones a
// visitor scrolls to or opens. Each distinct id set is one Supabase read per
// CDN hour, so egress follows what people look at rather than the whole league.
const ID = /^[1-9]\d{0,9}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length === 0 || ids.length > DETAIL_IDS || ids.some((id) => !ID.test(id))) {
    return Response.json({ error: "Invalid player list" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const players = await fetchPlayerDetails([...new Set(ids)].map(Number).sort((a, b) => a - b));
    return Response.json(
      { players },
      {
        headers: {
          "Cache-Control": "public, max-age=0, must-revalidate",
          "Vercel-CDN-Cache-Control": "public, s-maxage=3600",
        },
      }
    );
  } catch (error) {
    console.error("mlb player details fetch failed:", error);
    return Response.json(
      { error: "Player details are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
