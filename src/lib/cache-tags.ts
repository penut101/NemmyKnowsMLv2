// Tags describe source tables, so a publish expires only reads that depend on it.
// Keep the sport tag for explicit whole-sport refreshes from older callers.
export function tableCacheTag(sport: string, table: string) {
  return `${sport}:${table}`;
}

export function restCacheTags(sport: string, url: URL): string[] {
  const resource = url.pathname.split("/rest/v1/")[1];
  if (!resource.startsWith("rpc/")) {
    return [sport, tableCacheTag(sport, resource)];
  }

  const rpc = resource.slice(4);
  let tables: string[];
  switch (rpc) {
    case "recommendation_summary":
    case "recommendation_dashboard":
      tables = ["recommendations"];
      break;
    case "latest_market_snapshots":
      tables = ["market_snapshots"];
      break;
    case "forecast_accuracy":
      // The live_predictions views read frozen snapshots and completed results.
      tables = url.searchParams.get("p_source") === "backtest"
        ? ["backtest_predictions"]
        : ["game_results", "forecast_snapshots", ...(sport === "nhl" ? ["market_snapshots"] : [])];
      break;
    default:
      // Unknown RPC dependencies stay conservative without expiring table reads.
      return [sport, tableCacheTag(sport, "rpc")];
  }
  return [sport, ...tables.map((table) => tableCacheTag(sport, table))];
}
