import { fetchProspectPage } from "@/lib/mlb-prospects";
import { parseProspectQuery } from "@/lib/prospect-values";

// One page of forty prospects for a whitelisted filter set. Each canonical URL
// is one Supabase read per CDN hour, so reads follow the filters people use
// rather than the size of the table. The table is published weekly.
export async function GET(request: Request) {
  const parsed = parseProspectQuery(new URL(request.url).searchParams);
  if (!parsed) {
    return Response.json({ error: "Invalid prospect filters" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const page = await fetchProspectPage(parsed.filters, parsed.offset);
    return Response.json(page, {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": "public, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("mlb prospects fetch failed:", error);
    return Response.json(
      { error: "Prospects are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
