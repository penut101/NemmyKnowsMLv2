import { cache } from "react";
import {
  EMPTY_GRADES,
  ID_CHUNK,
  PAGE,
  buildGradedPlayers,
  chunk,
  rankIndex,
  toIndexRow,
  type GradedPlayer,
  type IndexRow,
  type PlayerIndexRow,
  type PositionGrades,
} from "@/lib/position-grades";
import { supabaseCfb } from "@/lib/supabase";
import type {
  CfbBacktestPrediction,
  CfbGradedGame,
  CfbHeismanBoardRow,
  CfbHeismanHistory,
  CfbPerformanceMetric,
  CfbPlayerModelMeta,
  CfbPlayerValue,
  CfbPositionTrait,
  CfbTeamIdentity,
  CfbTeamRating,
  CfbTeamUnitRating,
} from "@/lib/types";

// Team identity is keyed by team_id alone, so one fetch serves every table on
// a page. A failure here must not take the page down: the tables degrade to
// plain text without logos or team colors.
export async function fetchTeams(): Promise<Map<number, CfbTeamIdentity>> {
  const { data, error } = await supabaseCfb.from("teams").select("*");
  if (error) {
    console.error("cfb teams fetch failed:", error.message);
    return new Map();
  }
  return new Map(
    ((data ?? []) as CfbTeamIdentity[]).map((t) => [t.team_id, t])
  );
}

// The published ratings artifact for the latest (season, week).
// Cached per request: generateMetadata and the page both read it.
export const fetchLatestRatings = cache(async (): Promise<{
  ratings: CfbTeamRating[];
  season: number | null;
  week: number | null;
}> => {
  const latestRes = await supabaseCfb
    .from("team_ratings")
    .select("season, week")
    .order("season", { ascending: false })
    .order("week", { ascending: false })
    .limit(1);
  const latest = latestRes.data?.[0];
  if (!latest) return { ratings: [], season: null, week: null };

  const ratingsRes = await supabaseCfb
    .from("team_ratings")
    .select("*")
    .eq("season", latest.season)
    .eq("week", latest.week)
    .order("power_rating", { ascending: false });
  return {
    ratings: (ratingsRes.data ?? []) as CfbTeamRating[],
    season: latest.season,
    week: latest.week,
  };
});

// Descriptive unit companions for the same published ratings snapshot.
// Missing historical unit data is represented on the row itself rather than
// making the whole request fail.
export async function fetchUnitRatings(
  season: number,
  week: number
): Promise<CfbTeamUnitRating[]> {
  const { data, error } = await supabaseCfb
    .from("team_unit_ratings")
    .select("*")
    .eq("season", season)
    .eq("week", week);
  if (error) {
    console.error("cfb unit ratings fetch failed:", error.message);
    return [];
  }
  return (data ?? []) as CfbTeamUnitRating[];
}

// Supabase caps a response at 1000 rows; page the full backtest through
// sequential ranges (about 4 requests for 2021-2025).
export async function fetchFullBacktest(): Promise<CfbBacktestPrediction[]> {
  const pageSize = 1000;
  const all: CfbBacktestPrediction[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseCfb
      .from("backtest_predictions")
      .select("*")
      .order("season", { ascending: true })
      .order("week", { ascending: true })
      .order("game_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as CfbBacktestPrediction[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

export interface CfbLivePerformance {
  season: number | null;
  metrics: CfbPerformanceMetric[];
  lastGradedAt: string | null;
  latestKickoff: string | null;
}

// Live-season grading for the most recent graded season. Every number here
// comes from frozen records graded by the backend; the page only formats
// them. A failure degrades to the empty state rather than failing the build.
export async function fetchLivePerformance(): Promise<CfbLivePerformance> {
  const empty: CfbLivePerformance = {
    season: null,
    metrics: [],
    lastGradedAt: null,
    latestKickoff: null,
  };
  const latestRes = await supabaseCfb
    .from("graded_games")
    .select("season, graded_at, start_date")
    .order("season", { ascending: false })
    .order("graded_at", { ascending: false })
    .limit(1);
  const latest = latestRes.data?.[0];
  if (latestRes.error || !latest) return empty;

  const [metricsRes, kickoffRes] = await Promise.all([
    supabaseCfb
      .from("performance_metrics")
      .select("*")
      .eq("season", latest.season)
      .order("segment_order", { ascending: true }),
    supabaseCfb
      .from("graded_games")
      .select("start_date")
      .eq("season", latest.season)
      .order("start_date", { ascending: false })
      .limit(1),
  ]);
  if (metricsRes.error) {
    console.error("cfb performance metrics fetch failed:", metricsRes.error.message);
    return empty;
  }
  return {
    season: latest.season,
    metrics: (metricsRes.data ?? []) as CfbPerformanceMetric[],
    lastGradedAt: latest.graded_at,
    latestKickoff: kickoffRes.data?.[0]?.start_date ?? null,
  };
}

// The most recent season with graded live games, used by the history page to
// decide which tab is live and which are backtest.
export async function fetchLiveGradedSeason(): Promise<number | null> {
  const { data } = await supabaseCfb
    .from("graded_games")
    .select("season")
    .order("season", { ascending: false })
    .limit(1);
  return data?.[0]?.season ?? null;
}

export type { CfbGradedGame };

export interface CfbHeismanTracker {
  season: number | null;
  week: number | null;
  asOf: string | null;
  values: CfbPlayerValue[];
  trajectories: CfbPlayerValue[];
  board: CfbHeismanBoardRow[];
  boardWeek: number | null;
  history: CfbHeismanHistory[];
  meta: CfbPlayerModelMeta | null;
}

const EMPTY_TRACKER: CfbHeismanTracker = {
  season: null,
  week: null,
  asOf: null,
  values: [],
  trajectories: [],
  board: [],
  boardWeek: null,
  history: [],
  meta: null,
};

const VALUE_ROWS = 400;
const TRAJECTORY_PLAYERS = 8;
const BOARD_ROWS = 25;

// The latest weekly snapshot of player value with the Heisman board built on
// it. Every number is a frozen backend artifact; the page only formats them,
// and any failure degrades to the empty state rather than failing the build.
export const fetchHeismanTracker = cache(async (): Promise<CfbHeismanTracker> => {
  const latestRes = await supabaseCfb
    .from("player_values")
    .select("season, week, as_of")
    .order("season", { ascending: false })
    .order("week", { ascending: false })
    .limit(1);
  const latest = latestRes.data?.[0];
  if (latestRes.error || !latest) return EMPTY_TRACKER;

  const [valuesRes, boardWeekRes, historyRes, metaRes] = await Promise.all([
    supabaseCfb
      .from("player_values")
      .select("*")
      .eq("season", latest.season)
      .eq("week", latest.week)
      .order("overall_rank", { ascending: true })
      .range(0, VALUE_ROWS - 1),
    supabaseCfb
      .from("heisman_board")
      .select("week")
      .eq("season", latest.season)
      .order("week", { ascending: false })
      .limit(1),
    supabaseCfb
      .from("heisman_history")
      .select("*")
      .order("season", { ascending: false }),
    supabaseCfb
      .from("player_model_meta")
      .select("*")
      .eq("season", latest.season)
      .limit(1),
  ]);
  if (valuesRes.error) {
    console.error("cfb player values fetch failed:", valuesRes.error.message);
    return EMPTY_TRACKER;
  }
  const values = (valuesRes.data ?? []) as CfbPlayerValue[];
  const boardWeek = boardWeekRes.data?.[0]?.week ?? null;

  const leaders = values.slice(0, TRAJECTORY_PLAYERS).map((v) => v.athlete_id);
  const [trajectoryRes, boardRes] = await Promise.all([
    supabaseCfb
      .from("player_values")
      .select("*")
      .eq("season", latest.season)
      .in("athlete_id", leaders)
      .order("week", { ascending: true }),
    boardWeek == null
      ? Promise.resolve({ data: [] as CfbHeismanBoardRow[] })
      : supabaseCfb
          .from("heisman_board")
          .select("*")
          .eq("season", latest.season)
          .eq("week", boardWeek)
          .order("predicted_rank", { ascending: true })
          .limit(BOARD_ROWS),
  ]);

  return {
    season: latest.season,
    week: latest.week,
    asOf: latest.as_of,
    values,
    trajectories: (trajectoryRes.data ?? []) as CfbPlayerValue[],
    board: (boardRes.data ?? []) as CfbHeismanBoardRow[],
    boardWeek,
    history: (historyRes.data ?? []) as CfbHeismanHistory[],
    meta: ((metaRes.data ?? [])[0] as CfbPlayerModelMeta | undefined) ?? null,
  };
});

// Player grades: the latest published week of cfb.position_traits. The page
// reads a compact index of every graded player (for search and filters), the
// full rows of the top of each position, and fetches other players' rows on
// demand through /cfb/api/player-traits, so a revalidation moves a few hundred
// kilobytes rather than the whole table. The model is shared with the NFL in
// lib/position-grades.
export type CfbGradedPlayer = GradedPlayer;
export type CfbPlayerIndexRow = PlayerIndexRow;
export type CfbPositionGrades = PositionGrades;

// The CFB table has no headshot column; portraits come from the athlete id.
const CFB_INDEX_COLUMNS = "athlete_id, athlete_name, team, position_group, games, value, percentile";

async function fetchGradeIndex(season: number): Promise<IndexRow[]> {
  const rows: IndexRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await supabaseCfb
      .from("position_traits")
      .select(CFB_INDEX_COLUMNS)
      .eq("season", season)
      .eq("trait", "grade")
      .order("athlete_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (res.error) {
      console.error("cfb position traits index fetch failed:", res.error.message);
      return rows;
    }
    rows.push(...((res.data ?? []) as IndexRow[]));
    if ((res.data?.length ?? 0) < PAGE) return rows;
  }
}

export async function fetchPlayerTraitRows(season: number, ids: string[]): Promise<CfbPositionTrait[]> {
  const parts = await Promise.all(
    chunk(ids, ID_CHUNK).map((part) =>
      supabaseCfb
        .from("position_traits")
        .select("*")
        .eq("season", season)
        .in("athlete_id", part)
        .limit(PAGE)
    )
  );
  return parts.flatMap((res) => (res.data ?? []) as CfbPositionTrait[]);
}

export const fetchPositionGrades = cache(async (): Promise<CfbPositionGrades> => {
  const latestRes = await supabaseCfb
    .from("position_traits")
    .select("season, week, as_of, model_version")
    .eq("trait", "grade")
    .order("season", { ascending: false })
    .order("week", { ascending: false })
    .limit(1);
  const latest = latestRes.data?.[0];
  if (latestRes.error || !latest) return EMPTY_GRADES;

  const [gradeRows, { ratings }] = await Promise.all([fetchGradeIndex(latest.season), fetchLatestRatings()]);
  const conferenceOf = new Map(ratings.map((r) => [r.team, r.conference] as const));
  const { index, topIds, gradedCounts } = rankIndex(
    gradeRows.map((row) => toIndexRow(row, conferenceOf.get(row.team ?? "") ?? null))
  );
  const details = buildGradedPlayers(await fetchPlayerTraitRows(latest.season, topIds));
  return {
    season: latest.season,
    week: latest.week,
    asOf: latest.as_of,
    modelVersion: latest.model_version,
    index,
    details,
    gradedCounts,
  };
});
