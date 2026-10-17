// Display vocabulary for the position_traits tables of both football sports.
// The names are what a fan reads on the card; the one-sentence explanations
// open from the info icon. The trait keys are the backends' and must stay in
// step with momentumcfb's and momentumnfl's position_traits_v1 reports.

export type GradeSport = "cfb" | "nfl";

export const POSITION_ORDER = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "P"] as const;
export type PositionGroup = (typeof POSITION_ORDER)[number];

export const GRADE_TIP =
  "A 20 to 80 scouting grade. His traits combined with weights fitted on 2020 to 2024 to predict a player's own next-season production, with EPA credit as one of the traits. 50 is the average qualified FBS player at the position this week and 10 points is one standard deviation. The ± is the noise at his game count.";

export const WAR_TIP =
  "Wins above replacement: his points above a replacement-level player at his position (credited plays, opponent adjusted, shrunk toward the position), converted to wins with each game's leverage from the pregame projection. Defensive credit covers only tagged disruptions, so defensive WAR is undercounted.";

const NFL_GRADE_TIP =
  "A 20 to 80 scouting grade. His traits combined with weights set on 2016 to 2024 by how reliably each trait repeats from game to game, how much of it travels with a player who changes teams, and, where it predicts better, a fit to his own next-season EPA credit. 50 is the average qualified NFL player at the position this week and 10 points is one standard deviation. The ± is the noise at his game count.";

const NFL_WAR_TIP =
  "Wins above replacement: his opponent-adjusted EPA credit on competitive plays above the replacement level at his position, converted to wins with each game's leverage from the pregame projection. Defensive credit covers tagged disruptions and tackles on stops, never coverage, so defensive WAR is undercounted.";

// Copy that differs between the sports: who the percentile pool is, and how
// the grade and WAR explain themselves.
export const SPORT_COPY: Record<GradeSport, { pool: string; gradeTip: string; warTip: string; apiPath: string; groupLabel: string }> = {
  cfb: { pool: "qualified FBS players", gradeTip: GRADE_TIP, warTip: WAR_TIP, apiPath: "/cfb/api/player-traits", groupLabel: "Conference" },
  nfl: { pool: "qualified NFL players", gradeTip: NFL_GRADE_TIP, warTip: NFL_WAR_TIP, apiPath: "/nfl/api/player-traits", groupLabel: "Division" },
};

export const TRAIT_LABELS: Record<string, { label: string; tip: string }> = {
  "epa.credit": {
    label: "EPA credit",
    tip: "His credited plays valued by expected points added, opponent adjusted and shrunk toward the position, per game. This is player value v4.",
  },
  "qb.drive_engine": {
    label: "Late-down conversions",
    tip: "Conversions on third and fourth down and inside two minutes, above what each situation usually converts, adjusted for the defense faced.",
  },
  "qb.explosive": {
    label: "Deep completions",
    tip: "Completions of 20 or more yards per dropback, adjusted for the defense faced.",
  },
  "qb.ball_security": {
    label: "Ball security",
    tip: "Win probability given away on his interceptions and fumbles, per dropback. A clean game scores 0; higher is better.",
  },
  "qb.floor": {
    label: "Bad-game floor",
    tip: "His 20th percentile game by adjusted EPA per dropback: how he plays on his bad days, not on average.",
  },
  "qb.legs": {
    label: "Rushing",
    tip: "Success rate on scrambles and designed runs above what each situation usually converts, adjusted for the defense.",
  },
  "qb.pressure_handling": {
    label: "Sack avoidance",
    tip: "Sacks taken per dropback against the protection he inherits: the team's other passers, or the league rate when there are none. Inferred.",
  },
  "qb.receiver_independence": {
    label: "Beyond his receivers",
    tip: "His value per target above what the same receivers produce with other passers. Inferred; needs receivers who caught passes from someone else.",
  },
  "rb.yards_over_expected": {
    label: "Yards over expected",
    tip: "Yards per carry above what the down, distance, field position and run defense usually allow.",
  },
  "rb.stuff_avoidance": {
    label: "Stuff avoidance",
    tip: "Carries held to no gain, compared with the team's other backs running behind the same line in the same games. Inferred.",
  },
  "rb.breakaway": {
    label: "Breakaway runs",
    tip: "Carries of 10 or more yards per carry, adjusted for the defense faced.",
  },
  "rb.short_yardage": {
    label: "Short yardage",
    tip: "Conversions on third or fourth and two or less, or inside the three, above what those spots usually convert.",
  },
  "rb.receiving": { label: "Receiving", tip: "Adjusted EPA per target when thrown to." },
  "rb.ball_security": {
    label: "Ball security",
    tip: "Win probability given away on his fumbles, per touch. A clean game scores 0; higher is better.",
  },
  "rb.line_independence": {
    label: "Beyond his line",
    tip: "EPA per carry compared with the team's other backs in the same games, so the line and scheme cancel out. Inferred.",
  },
  "rec.target_share": {
    label: "Target share",
    tip: "His share of the team's targets in the games he played. In seasons where the feed drops most targets this is reception share.",
  },
  "rec.value_per_target": {
    label: "Value per target",
    tip: "Adjusted EPA per target (per reception in receptions mode).",
  },
  "rec.explosive": {
    label: "Big catches",
    tip: "Receptions of 20 or more yards per target, adjusted for the defense faced.",
  },
  "rec.late_down": {
    label: "Late-down conversions",
    tip: "Third and fourth down targets converted above what the situation usually converts, adjusted for the defense.",
  },
  "rec.qb_independence": {
    label: "Beyond his quarterback",
    tip: "Value per target compared with the same passer's other targets in the same games. Inferred.",
  },
  "def.havoc": {
    label: "Havoc",
    tip: "Tackles for loss, forced fumbles, pass breakups and interceptions per game, adjusted for the offense faced.",
  },
  "def.pass_rush": {
    label: "Pass rush",
    tip: "Sacks weighted by the win probability each one swung, plus hurries priced at the league's going rate, per game.",
  },
  "def.finishing": {
    label: "Finishing",
    tip: "Sacks as a share of sacks plus hurries: how often pressure becomes a sack.",
  },
  "def.run_stop": {
    label: "Run stops",
    tip: "Tackles for loss that were not sacks, per game, adjusted for the offense faced.",
  },
  "def.every_week": {
    label: "Every week",
    tip: "Share of his games with at least one disruption: a tackle for loss, sack, breakup, interception or forced fumble.",
  },
  "def.tackle_share": {
    label: "Tackle share",
    tip: "His tackles as a share of the team's tackles in the games he played.",
  },
  "def.coverage": {
    label: "Coverage plays",
    tip: "Pass breakups and interceptions per game, adjusted for the offense faced.",
  },
  "def.ball_production": {
    label: "Ball production",
    tip: "Interceptions and pass breakups per game, adjusted for the offense faced.",
  },
  "def.run_support": {
    label: "Run support tackles",
    tip: "Solo tackles per game. More tackles by a defensive back can mean catches allowed, so no direction is assumed.",
  },
  "def.impact": {
    label: "With vs without",
    tip: "Points per play the defense allowed in games he played versus games he missed, opponent adjusted and shrunk toward zero. Inferred; needs at least one absence.",
  },
  "def.pass_impact": {
    label: "Pass defense with vs without",
    tip: "Same as with vs without, on pass plays only. Inferred.",
  },
  "ol.protection": {
    label: "Protection",
    tip: "Sacks allowed against what the league rate would predict for the team's dropbacks, adjusted for the defense faced. Unit rating.",
  },
  "ol.stuff_rate": {
    label: "Stuffs allowed",
    tip: "Carries held to no gain, as a rate, adjusted for the defense faced. Unit rating; higher is fewer stuffs.",
  },
  "ol.short_yardage": {
    label: "Short yardage",
    tip: "Short-yardage carries converted above expectation. Unit rating.",
  },
  "ol.line_yards": {
    label: "Line yards",
    tip: "Adjusted line yards per carry, the line's share of rushing yards, adjusted for the defense faced. Unit rating.",
  },
  "p.punt_average": {
    label: "Punt distance",
    tip: "Yards per punt above the league average through the previous week.",
  },
  "p.net": {
    label: "Net punting",
    tip: "Gross yards less return yards and 20 for each touchback, per punt.",
  },
  "p.fair_catch_share": {
    label: "Fair catches",
    tip: "Share of his punts fair caught: the closest the data gets to hang time.",
  },
  "p.no_return_share": {
    label: "No return",
    tip: "Share of his punts the returner never ran back: fair caught, downed, out of bounds or a touchback.",
  },
};

// NFL-only traits, and NFL wording where the same trait is built from a
// different feed (quarterback hits rather than hurries, no player value v4).
const NFL_TRAIT_LABELS: Record<string, { label: string; tip: string }> = {
  "epa.credit": {
    label: "EPA credit",
    tip: "His credited competitive plays valued by expected points added, adjusted for the opponent through the previous week, per credited game. The passer and receiver split a pass, a rusher owns a carry, and a defender shares a play he was tagged on.",
  },
  "qb.accuracy": {
    label: "Accuracy",
    tip: "Completion percentage over expected per throw, from the feed's expected completion model, adjusted for the defense faced.",
  },
  "qb.legs": {
    label: "Rushing",
    tip: "Success rate on scrambles and designed runs above what each situation usually produces, adjusted for the defense.",
  },
  "rec.yac_over_expected": {
    label: "Yards after catch",
    tip: "Yards after the catch above the feed's expectation for each reception, adjusted for the defense faced.",
  },
  "rec.target_share": {
    label: "Target share",
    tip: "His share of the team's competitive targets in the games he played.",
  },
  "rec.value_per_target": { label: "Value per target", tip: "Adjusted EPA per target." },
  "def.havoc": {
    label: "Havoc",
    tip: "Tackles for loss, forced fumbles, passes defended and interceptions per game, adjusted for the offense faced.",
  },
  "def.pass_rush": {
    label: "Pass rush",
    tip: "Sacks weighted by the win probability each one swung, plus quarterback hits priced at the median sack, per game.",
  },
  "def.finishing": {
    label: "Finishing",
    tip: "Sacks as a share of sacks plus quarterback hits: how often pressure becomes a sack.",
  },
  "def.stops": {
    label: "Stops",
    tip: "Tackles, tackles for loss and sacks on plays the offense lost expected points on, per game, adjusted for the offense faced. A tackle after a long gain is not a stop.",
  },
  "def.coverage": {
    label: "Coverage plays",
    tip: "Passes defended and interceptions per game, adjusted for the offense faced.",
  },
  "def.ball_production": {
    label: "Ball production",
    tip: "Interceptions and passes defended per game, adjusted for the offense faced.",
  },
  "def.impact": {
    label: "With vs without",
    tip: "Expected points per play the defense allowed in games he played versus games he missed, shrunk toward zero. Inferred; needs at least one absence.",
  },
  "ol.protection": {
    label: "Protection",
    tip: "Sacks and quarterback hits allowed against what the league rate would predict for the team's dropbacks, adjusted for the defense faced. Unit rating.",
  },
};

export function traitLabel(trait: string, sport: GradeSport = "cfb"): { label: string; tip: string } {
  const base = TRAIT_LABELS[trait] ?? { label: trait, tip: "" };
  return sport === "nfl" ? (NFL_TRAIT_LABELS[trait] ?? base) : base;
}

export const UNIT_PREFIX = "unit:";

export function isUnitRow(athleteId: string): boolean {
  return athleteId.startsWith(UNIT_PREFIX);
}
