export type NflPlayoffMetric =
  | "playoff"
  | "division_title"
  | "bye"
  | "divisional"
  | "conference_game"
  | "super_bowl"
  | "champion";
export interface NflPlayoffTeam extends Record<NflPlayoffMetric, number> {
  id: string;
  team: string;
  conference: "AFC" | "NFC";
  division: string;
  wins: number;
  losses: number;
  ties: number;
  expected_wins: number;
  seed_probabilities: number[];
  deep_tiebreak_rate: number;
}
export interface NflPlayoffGame {
  id: string;
  home: string;
  away: string;
  week: number;
  date: string | null;
  neutral: boolean;
  home_win_probability: number;
}
export interface NflPlayoffSlot {
  conference: "AFC" | "NFC";
  seed: number;
  team_id: string;
}
export interface NflPlayoffPath {
  round: "Wild Card" | "Divisional" | "Conference" | "Super Bowl";
  conference: "AFC" | "NFC" | "NFL";
  home: string;
  away: string;
  winner: string;
  home_seed: number | null;
  away_seed: number | null;
  home_win_probability: number;
}
export interface NflQbAvailability {
  team: string;
  player: string;
  backup: string;
  status: "window" | "unknown" | "season_out" | "cleared" | "overdue";
  expected_return_date?: string;
  return_earliest?: string | null;
  return_latest?: string | null;
  reported_at: string;
  observed_at: string;
  source_url: string;
  uncertainty: string;
  games: { game_id: string; week: number; date: string; return_share: number | null }[];
  postseason: { round: string; date: string; return_share: number | null }[];
}
export interface NflPlayoffPayload {
  schema_version: 1;
  season: number;
  model: string;
  model_as_of: string;
  results_as_of: string;
  draws: number;
  seed: number;
  teams: NflPlayoffTeam[];
  games: NflPlayoffGame[];
  bracket: NflPlayoffSlot[];
  path: NflPlayoffPath[];
  limitations: string[];
  qb_availability?: NflQbAvailability[];
}
const totals: Record<NflPlayoffMetric, number> = {
  playoff: 14,
  division_title: 8,
  bye: 2,
  divisional: 8,
  conference_game: 4,
  super_bowl: 2,
  champion: 1,
};
const probability = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const integer = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  /(Z|[+-]\d\d:\d\d)$/.test(v) &&
  Number.isFinite(Date.parse(v));
const text = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 1000;
const mass = (values: number[], target: number) =>
  Math.abs(values.reduce((a, b) => a + b, 0) - target) < 1e-7;
export function parseNflPlayoffPayload(
  input: unknown,
): NflPlayoffPayload | null {
  try {
    // The entire contract is checked before crossing the server/client boundary.
    const p = input as NflPlayoffPayload;
    if (
      !p ||
      p.schema_version !== 1 ||
      !integer(p.season, 2026, 2100) ||
      !integer(p.draws, 1000, 1000000) ||
      !integer(p.seed, 0, Number.MAX_SAFE_INTEGER) ||
      !text(p.model) ||
      !date(p.model_as_of) ||
      !date(p.results_as_of) ||
      Date.parse(p.model_as_of) > Date.parse(p.results_as_of)
    )
      return null;
    if (
      !Array.isArray(p.teams) ||
      p.teams.length !== 32 ||
      new Set(p.teams.map((t) => t.id)).size !== 32
    )
      return null;
    if (p.qb_availability !== undefined) {
      if (!Array.isArray(p.qb_availability) || p.qb_availability.length > 32 ||
          new Set(p.qb_availability.map(q => q.team)).size !== p.qb_availability.length) return null;
      for (const q of p.qb_availability) {
        if (!p.teams.some(t => t.id === q.team) || !text(q.player) || !text(q.backup) ||
            !["window", "unknown", "season_out", "cleared", "overdue"].includes(q.status) ||
            !date(q.reported_at) || !date(q.observed_at) ||
            Date.parse(q.reported_at) > Date.parse(q.observed_at) ||
            Date.parse(q.observed_at) > Date.parse(p.results_as_of) ||
            !text(q.uncertainty) || !text(q.source_url) ||
            !["https:", "http:"].includes(new URL(q.source_url).protocol)) return null;
        if (["window", "cleared", "overdue"].includes(q.status) &&
            (!q.return_earliest || !q.return_latest ||
             !/^\d{4}-\d{2}-\d{2}$/.test(q.return_earliest) ||
             !/^\d{4}-\d{2}-\d{2}$/.test(q.return_latest) ||
             !Number.isFinite(Date.parse(q.return_earliest)) ||
             !Number.isFinite(Date.parse(q.return_latest)) || q.return_earliest > q.return_latest)) return null;
        if (!Array.isArray(q.games) || !Array.isArray(q.postseason) ||
            ![...q.games, ...q.postseason].every(g => date(g.date) && (g.return_share === null || probability(g.return_share))) ||
            !q.games.every(g => integer(g.week, 1, 18) && p.games.some(x => x.id === g.game_id && (x.home === q.team || x.away === q.team))) ||
            q.postseason.length !== 4) return null;
      }
    }
    for (const t of p.teams) {
      if (
        !text(t.id) ||
        !text(t.team) ||
        !text(t.division) ||
        !["AFC", "NFC"].includes(t.conference) ||
        ![t.wins, t.losses, t.ties].every((n) => integer(n, 0, 17)) ||
        t.wins + t.losses + t.ties > 17 ||
        !Number.isFinite(t.expected_wins) ||
        t.expected_wins < t.wins ||
        t.expected_wins > 17 - t.losses - t.ties ||
        !probability(t.deep_tiebreak_rate)
      )
        return null;
      if (
        !Object.keys(totals).every((k) =>
          probability(t[k as NflPlayoffMetric]),
        ) ||
        !Array.isArray(t.seed_probabilities) ||
        t.seed_probabilities.length !== 7 ||
        !t.seed_probabilities.every(probability) ||
        !mass(t.seed_probabilities, t.playoff)
      )
        return null;
      if (!(
        t.champion <= t.super_bowl &&
        t.super_bowl <= t.conference_game &&
        t.conference_game <= t.divisional &&
        t.divisional <= t.playoff &&
        t.bye <= t.division_title &&
        t.division_title <= t.playoff
      ))
        return null;
    }
    for (const [key, target] of Object.entries(totals))
      if (
        !mass(
          p.teams.map((t) => t[key as NflPlayoffMetric]),
          target,
        )
      )
        return null;
    const byId = new Map(p.teams.map((t) => [t.id, t]));
    if (
      !Array.isArray(p.bracket) ||
      p.bracket.length !== 14 ||
      new Set(p.bracket.map((s) => s.team_id)).size !== 14
    )
      return null;
    for (const conf of ["AFC", "NFC"] as const) {
      const members = p.teams.filter((t) => t.conference === conf),
        slots = p.bracket.filter((s) => s.conference === conf);
      if (
        members.length !== 16 ||
        slots.length !== 7 ||
        slots
          .map((s) => s.seed)
          .sort()
          .join() !== "1,2,3,4,5,6,7" ||
        slots.some((s) => byId.get(s.team_id)?.conference !== conf) ||
        new Set(
          slots
            .filter((s) => s.seed <= 4)
            .map((s) => byId.get(s.team_id)?.division),
        ).size !== 4
      )
        return null;
      for (const [key, target] of Object.entries(totals))
        if (
          key !== "champion" &&
          !mass(
            members.map((t) => t[key as NflPlayoffMetric]),
            target / 2,
          )
        )
          return null;
      for (let seed = 0; seed < 7; seed++)
        if (
          !mass(
            members.map((t) => t.seed_probabilities[seed]),
            1,
          )
        )
          return null;
    }
    if (
      !Array.isArray(p.games) ||
      p.games.length > 272 ||
      new Set(p.games.map((g) => g.id)).size !== p.games.length ||
      p.games.some(
        (g) =>
          !text(g.id) ||
          !byId.has(g.home) ||
          !byId.has(g.away) ||
          g.home === g.away ||
          !integer(g.week, 1, 18) ||
          !(g.date === null || date(g.date)) ||
          typeof g.neutral !== "boolean" ||
          !probability(g.home_win_probability),
      )
    )
      return null;
    if (!Array.isArray(p.path) || p.path.length !== 13) return null;
    const finalists: string[] = [];
    for (const conf of ["AFC", "NFC"] as const) {
      const slots = p.bracket
          .filter((s) => s.conference === conf)
          .sort((a, b) => a.seed - b.seed),
        seeds = new Map(slots.map((s) => [s.team_id, s.seed]));
      let alive = [slots[0].team_id];
      for (const round of ["Wild Card", "Divisional", "Conference"] as const) {
        const games = p.path.filter(
          (g) => g.conference === conf && g.round === round,
        );
        const pairs =
          round === "Wild Card"
            ? [
                [slots[1].team_id, slots[6].team_id],
                [slots[2].team_id, slots[5].team_id],
                [slots[3].team_id, slots[4].team_id],
              ]
            : round === "Divisional"
              ? [
                  [alive[0], alive[3]],
                  [alive[1], alive[2]],
                ]
              : [[alive[0], alive[1]]];
        if (
          games.length !== pairs.length ||
          games.some(
            (g, i) =>
              g.home !== pairs[i][0] ||
              g.away !== pairs[i][1] ||
              ![g.home, g.away].includes(g.winner) ||
              !probability(g.home_win_probability) ||
              g.home_seed !== seeds.get(g.home) ||
              g.away_seed !== seeds.get(g.away),
          )
        )
          return null;
        alive = (
          round === "Wild Card"
            ? [...alive, ...games.map((g) => g.winner)]
            : games.map((g) => g.winner)
        ).sort((a, b) => seeds.get(a)! - seeds.get(b)!);
      }
      finalists.push(alive[0]);
    }
    const sb = p.path.filter((g) => g.round === "Super Bowl");
    if (
      sb.length !== 1 ||
      sb[0].conference !== "NFL" ||
      sb[0].home !== finalists[0] ||
      sb[0].away !== finalists[1] ||
      !finalists.includes(sb[0].winner) ||
      !probability(sb[0].home_win_probability) ||
      sb[0].home_seed !== null ||
      sb[0].away_seed !== null
    )
      return null;
    if (
      !Array.isArray(p.limitations) ||
      p.limitations.length > 20 ||
      !p.limitations.every(text)
    )
      return null;
    return p;
  } catch {
    return null;
  }
}
