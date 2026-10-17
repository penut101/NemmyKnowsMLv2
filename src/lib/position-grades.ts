// The player grades page's data model, shared by college football and the
// NFL. Each sport's lib reads its own position_traits table and maps the rows
// through these helpers, so the page and its card component never know which
// schema they are rendering.

// The columns both position_traits tables carry. The CFB table also has a
// team_id and the NFL table a headshot_url; neither is needed here beyond the
// optional headshot.
export interface PositionTraitRow {
  season: number;
  week: number;
  as_of: string;
  model_version: string;
  athlete_id: string;
  athlete_name: string | null;
  headshot_url?: string | null;
  team: string | null;
  position_group: string;
  games: number | null;
  trait: string;
  value: number | null;
  percentile: number | null;
  kind: string | null;
  in_grade: boolean;
  uncertainty: number | null;
  reliability?: number | null;
  points_above_replacement: number | null;
}

export interface GradedPlayer {
  athleteId: string;
  name: string;
  team: string;
  headshotUrl: string | null;
  games: number | null;
  grade: number | null;
  gradePercentile: number | null;
  uncertainty: number | null;
  // The fitted forecast behind a rated position's grade, in its own units
  // (EPA per dropback for a passer, EPA per game for a back), with the
  // out-of-sample range of outcomes.
  rating: number | null;
  ratingRange: number | null;
  war: number | null;
  warPercentile: number | null;
  pointsAboveReplacement: number | null;
  traits: PositionTraitRow[];
}

// One row per graded player for search and filters. `group` is the filter
// the page offers beside position: the conference in college football, the
// division in the NFL.
export interface PlayerIndexRow {
  athleteId: string;
  name: string;
  team: string;
  headshotUrl: string | null;
  group: string | null;
  positionGroup: string;
  games: number | null;
  grade: number | null;
  percentile: number | null;
}

export interface PositionGrades {
  season: number | null;
  week: number | null;
  asOf: string | null;
  modelVersion: string | null;
  index: PlayerIndexRow[];
  details: Record<string, GradedPlayer>;
  gradedCounts: Record<string, number>;
}

export const EMPTY_GRADES: PositionGrades = {
  season: null,
  week: null,
  asOf: null,
  modelVersion: null,
  index: [],
  details: {},
  gradedCounts: {},
};

// Full rows are fetched for this many players per position on the server;
// the rest load on demand through the sport's player-traits API route.
export const GRADE_ROWS = 40;
export const ID_CHUNK = 50;
export const PAGE = 1000;
export const INDEX_COLUMNS =
  "athlete_id, athlete_name, headshot_url, team, position_group, games, value, percentile";

export type IndexRow = Pick<
  PositionTraitRow,
  "athlete_id" | "athlete_name" | "headshot_url" | "team" | "position_group" | "games" | "value" | "percentile"
>;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Players and the OL unit rows of one position, as the page's card model,
// built from every row of those athletes for the season.
export function buildGradedPlayers(rows: PositionTraitRow[]): Record<string, GradedPlayer> {
  const byAthlete = new Map<string, PositionTraitRow[]>();
  for (const row of rows) {
    const list = byAthlete.get(row.athlete_id) ?? [];
    list.push(row);
    byAthlete.set(row.athlete_id, list);
  }
  const out: Record<string, GradedPlayer> = {};
  for (const [athleteId, list] of byAthlete) {
    const grade = list.find((r) => r.trait === "grade") ?? null;
    const rating = list.find((r) => r.trait === "rating") ?? null;
    const war = list.find((r) => r.trait === "war") ?? null;
    const first = grade ?? list[0];
    out[athleteId] = {
      athleteId,
      name: first.athlete_name ?? athleteId,
      team: first.team ?? "",
      headshotUrl: first.headshot_url ?? null,
      games: first.games,
      grade: grade?.value ?? null,
      gradePercentile: grade?.percentile ?? null,
      uncertainty: grade?.uncertainty ?? null,
      rating: rating?.value ?? null,
      ratingRange: rating?.uncertainty ?? null,
      war: war?.value ?? null,
      warPercentile: war?.percentile ?? null,
      pointsAboveReplacement: war?.points_above_replacement ?? null,
      traits: list
        .filter((r) => r.trait !== "grade" && r.trait !== "war" && r.trait !== "rating")
        .sort((a, b) => Number(b.in_grade) - Number(a.in_grade) || a.trait.localeCompare(b.trait)),
    };
  }
  return out;
}

export function toIndexRow(row: IndexRow, group: string | null): PlayerIndexRow {
  return {
    athleteId: row.athlete_id,
    name: row.athlete_name ?? row.athlete_id,
    team: row.team ?? "",
    headshotUrl: row.headshot_url ?? null,
    group,
    positionGroup: row.position_group,
    games: row.games,
    grade: row.value,
    percentile: row.percentile,
  };
}

// Best grade first, ties by percentile; the ids of the top of each position
// are the players whose full rows the page renders on the server.
export function rankIndex(index: PlayerIndexRow[]): { index: PlayerIndexRow[]; topIds: string[]; gradedCounts: Record<string, number> } {
  const sorted = [...index].sort(
    (a, b) => (b.grade ?? -Infinity) - (a.grade ?? -Infinity) || (b.percentile ?? -1) - (a.percentile ?? -1)
  );
  const gradedCounts: Record<string, number> = {};
  const seen: Record<string, number> = {};
  const topIds: string[] = [];
  for (const row of sorted) {
    gradedCounts[row.positionGroup] = (gradedCounts[row.positionGroup] ?? 0) + 1;
    if ((seen[row.positionGroup] ?? 0) >= GRADE_ROWS) continue;
    seen[row.positionGroup] = (seen[row.positionGroup] ?? 0) + 1;
    topIds.push(row.athleteId);
  }
  return { index: sorted, topIds, gradedCounts };
}
