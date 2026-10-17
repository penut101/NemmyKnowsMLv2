import { cache } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/database-schema";

// The player valuation tables, written nightly by mlbmodel. The page reads the
// index (every column but the two jsonb blobs) once per hour and the detail
// (outlook, tip, traits) for the players a visitor actually opens.

export type PlayerValueRow = Tables<"mlb", "player_values">;
export type PlayerTraitRow = Tables<"mlb", "player_traits">;

export type PlayerValueIndex = Omit<PlayerValueRow, "outlook" | "tip">;

export interface OutlookYear {
  season: number;
  age: number;
  war: number | null;
  salary_musd: number;
  salary_kind: string;
  surplus_musd: number | null;
  in_control: boolean;
}

export type TraitInput = [name: string, weight: number, value: number, percentile: number | null];

export interface PlayerTrait extends Omit<PlayerTraitRow, "inputs"> {
  inputs: TraitInput[];
}

export interface PlayerDetail {
  outlook: OutlookYear[];
  tip: Record<string, number | string | null>;
  traits: PlayerTrait[];
}

export interface PlayerValues {
  asOf: string | null;
  season: number | null;
  modelVersion: string | null;
  index: PlayerValueIndex[];
}

const INDEX_COLUMNS =
  "player_id, player_name, team, team_id, level, position_group, secondary_positions, age, bats, throws, status, as_of, model_version, season, grade, grade_low, grade_high, grade_percentile, grade_reason, projected_war, trade_value_musd, trade_value_low, trade_value_high, market_value_musd, impact_war, impact_runs, playing_time, service_time, contract_status, fa_year, control_years, salary_current_musd, owed_through_control_musd, headshot_url, updated_at";
const PAGE = 1000;
export const DETAIL_IDS = 40;

export const fetchPlayerValues = cache(async (): Promise<PlayerValues> => {
  const index: PlayerValueIndex[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await supabase
      .from("player_values")
      .select(INDEX_COLUMNS)
      .order("player_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (res.error) {
      console.error("mlb player values fetch failed:", res.error.message);
      break;
    }
    index.push(...((res.data ?? []) as PlayerValueIndex[]));
    if ((res.data?.length ?? 0) < PAGE) break;
  }
  const first = index[0];
  return {
    asOf: first?.as_of ?? null,
    season: first?.season ?? null,
    modelVersion: first?.model_version ?? null,
    index,
  };
});

export async function fetchPlayerDetails(ids: number[]): Promise<Record<string, PlayerDetail>> {
  const signal = AbortSignal.timeout(10_000);
  const [valuesRes, traitsRes] = await Promise.all([
    supabase.from("player_values").select("player_id, outlook, tip").in("player_id", ids).limit(DETAIL_IDS).abortSignal(signal),
    supabase.from("player_traits").select("*").in("player_id", ids).limit(DETAIL_IDS * 16).abortSignal(signal),
  ]);
  // Failed or incomplete reads must reach the route's uncached 503 response.
  if (valuesRes.error) throw new Error(`Player outlook read failed: ${valuesRes.error.message}`);
  if (traitsRes.error) throw new Error(`Player traits read failed: ${traitsRes.error.message}`);
  const returnedIds = new Set(valuesRes.data?.map((row) => row.player_id));
  if (ids.some((id) => !returnedIds.has(id))) throw new Error("Player outlook rows missing");
  const out: Record<string, PlayerDetail> = {};
  for (const row of valuesRes.data ?? []) {
    out[String(row.player_id)] = {
      outlook: (row.outlook ?? []) as unknown as OutlookYear[],
      tip: (row.tip ?? {}) as Record<string, number | string | null>,
      traits: [],
    };
  }
  for (const row of (traitsRes.data ?? []) as PlayerTraitRow[]) {
    const detail = out[String(row.player_id)];
    if (!detail) continue;
    detail.traits.push({ ...row, inputs: (row.inputs ?? []) as unknown as TraitInput[] });
  }
  return out;
}
