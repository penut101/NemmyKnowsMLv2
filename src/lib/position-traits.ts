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

// The fitted ratings (NFL quarterbacks and running backs, version 2). Each
// measure's tip says how it is calculated; the card adds its measured
// reliability. Kinds: quality predicts future production, processing is what
// the passer does when the first read, the blitz or the pocket goes wrong,
// role is how much the coaching staff uses him, style repeats season to
// season but says nothing about production, noise does not repeat.
export const KIND_ORDER = ["quality", "processing", "role", "style", "noise"] as const;
export type MeasureKind = (typeof KIND_ORDER)[number];

export const KIND_LABELS: Record<MeasureKind, { label: string; tip: string }> = {
  quality: {
    label: "Quality",
    tip: "Measures that repeat from game to game and predict the player's future production. The ones marked grade carry weight in the fitted rating.",
  },
  processing: {
    label: "Processing",
    tip: "What the passer does when the play does not go as drawn: throws past the first read, the checkdown, and the blitz. From FTN charting of every throw since 2022.",
  },
  role: {
    label: "Role",
    tip: "How much the coaching staff uses him. For a running back this is the most stable thing the data has, and it carries most of the rating.",
  },
  style: {
    label: "Style",
    tip: "Fingerprints that repeat season to season but do not predict production: how he plays, not how well. Percentiles here rank the trait, not merit.",
  },
  noise: {
    label: "Noise",
    tip: "Measures that barely repeat from one game to the next. They are shown because people ask about them, and labelled so nobody reads a ranking into them.",
  },
};

export const RATING_LABELS: Record<string, { label: string; unit: string; tip: string }> = {
  QB: {
    label: "Forecast",
    unit: "EPA per dropback",
    tip: "The fitted forecast of his EPA per dropback over the rest of the season, from his production and processing measures to date and his prior season, each standardised among this week's qualified passers. The grade is this forecast placed on the 20 to 80 scale among them. The ± on the grade is the rating's own measurement error from odd against even games; the range beside the forecast is the wider spread of what the rest of a season actually brings.",
  },
  RB: {
    label: "Forecast",
    unit: "EPA per game",
    tip: "The fitted forecast of his EPA per game over the rest of the season, role times efficiency, from his touches, carry share, target rate and per-touch measures to date and his prior season. No efficiency measure for backs repeats game to game, so this rests mostly on role and its band is wide on purpose.",
  },
};

const RATED_MEASURE_LABELS: Record<string, { label: string; tip: string }> = {
  // Quarterback quality
  epa_db: { label: "EPA per dropback", tip: "Expected points added summed over his competitive dropbacks (passes, sacks and scrambles), divided by dropbacks." },
  success_db: { label: "Success rate", tip: "Share of his dropbacks that gained expected points. More stable game to game than EPA and as predictive." },
  cpoe: { label: "Completion over expected", tip: "Completion percentage above what each throw's distance, location and situation usually completes, from nflfastR's expected completion model, averaged over his attempts." },
  anya: { label: "Adjusted net yards per attempt", tip: "Pass yards plus 20 per touchdown minus 45 per interception, divided by pass plays including sacks." },
  sack_rate: { label: "Sack rate", tip: "Sacks taken per dropback. Partly the line's, but the stable part is the passer's." },
  pfr_pressure_to_sack: { label: "Pressure to sack", tip: "Of the dropbacks on which he was pressured (Pro Football Reference charting), the share that ended in a sack. The passer's part of the sack problem." },
  late_down_conv: { label: "Late-down conversions", tip: "On third and fourth down and inside two minutes, his conversions above what each down, distance and field position usually converts." },
  epa_in_pocket: { label: "EPA in the pocket", tip: "EPA per dropback on plays FTN charts as thrown from the pocket." },
  epa_no_play_action: { label: "EPA without play action", tip: "EPA per dropback without a play fake, the part of his passing the scheme helps least." },
  catchable_rate: { label: "Catchable ball rate", tip: "Share of his attempts FTN charts as catchable." },
  // Quarterback processing
  beyond_first_read_rate: { label: "Throws past the first read", tip: "Share of his charted throws that went to the second read, a checkdown or a scramble drill rather than the first read. A trait, not a merit: high means the first read was often not there or he left it." },
  success_beyond_first: { label: "Success past the first read", tip: "Success rate on the throws that went past the first read: what happens when the play as drawn is not there." },
  epa_beyond_first: { label: "EPA past the first read", tip: "EPA per throw on the throws that went past the first read." },
  checkdown_rate: { label: "Checkdown rate", tip: "Share of his charted throws that were checkdowns. Lower is better in the rating." },
  blitz_sack_rate: { label: "Sacked when blitzed", tip: "Sacks per dropback on plays FTN charts with at least one blitzer. Blitz recognition shows up here first." },
  blitz_success: { label: "Success when blitzed", tip: "Success rate on dropbacks against a blitz." },
  int_worthy_beyond_first: { label: "Int-worthy past the first read", tip: "Interception-worthy throws (FTN) per throw past the first read." },
  // Quarterback style
  ngs_time_to_throw: { label: "Time to throw", tip: "Average seconds from snap to throw, from Next Gen tracking. One of the most stable things about a passer." },
  scramble_rate: { label: "Scramble rate", tip: "Scrambles per dropback." },
  out_of_pocket_rate: { label: "Out of pocket", tip: "Share of dropbacks FTN charts as out of the pocket." },
  play_action_rate: { label: "Play-action rate", tip: "Share of dropbacks with a play fake. Mostly the scheme's choice." },
  adot: { label: "Depth of target", tip: "Average air yards per attempt." },
  deep_rate: { label: "Deep throw rate", tip: "Attempts of 20 or more air yards per attempt." },
  ngs_aggressiveness: { label: "Aggressiveness", tip: "Share of attempts into tight windows, a defender within a yard, from Next Gen tracking." },
  throwaway_rate: { label: "Throwaway rate", tip: "Throwaways per attempt (FTN)." },
  motion_rate: { label: "Motion rate", tip: "Share of his dropbacks with pre-snap motion (FTN). A scheme fingerprint, not a passer's decision." },
  rpo_rate: { label: "RPO rate", tip: "Share of dropbacks that were run-pass options (FTN)." },
  screen_rate: { label: "Screen rate", tip: "Share of dropbacks that were screens (FTN)." },
  pfr_pressure_rate: { label: "Pressure rate faced", tip: "Share of dropbacks on which he was pressured (Pro Football Reference). Mostly the line's and the opponent's." },
  // Quarterback noise
  int_rate: { label: "Interception rate", tip: "Interceptions per attempt. It repeats at 0.05 from game to game: an interception tells you almost nothing about the next one." },
  int_worthy_rate: { label: "Int-worthy throw rate", tip: "Interception-worthy throws per attempt (FTN charting). Not much more stable than interceptions themselves." },
  turnover_wpa_db: { label: "Turnover cost", tip: "Win probability given away on his interceptions and fumbles, per dropback." },
  explosive_rate: { label: "Explosive completions", tip: "Completions of 20 or more yards per dropback." },
  scramble_epa: { label: "Scramble EPA", tip: "EPA per scramble." },
  // Running back
  epa_game: { label: "EPA per game", tip: "His rushing EPA plus half the EPA of his targets, per game." },
  epa_touch: { label: "EPA per touch", tip: "The same EPA per carry or target." },
  first_down_rate: { label: "First-down rate", tip: "Carries that gained the distance to go, per carry. The most stable efficiency measure a back has." },
  success_carry: { label: "Success rate", tip: "Carries that gained expected points, per carry." },
  stuff_rate: { label: "Stuff rate", tip: "Carries held to no gain or a loss, per carry. Lower is better." },
  yac_rec: { label: "Yards after catch", tip: "Yards after the catch per reception." },
  ngs_ryoe_att: { label: "Rush yards over expected", tip: "Next Gen's tracking-based yards over what the defenders' positions at handoff expected, per attempt. The best public isolation of the back from his line, and still not stable within a season." },
  pfr_yac_carry: { label: "Yards after contact", tip: "Yards after first contact per carry (Pro Football Reference)." },
  pfr_broken_tackle_rate: { label: "Broken tackles", tip: "Broken tackles per touch (Pro Football Reference)." },
  carry_share: { label: "Carry share", tip: "His carries as a share of his team's running back carries in the games he played." },
  touches_game: { label: "Touches per game", tip: "Carries plus targets per game." },
  target_rate: { label: "Target rate", tip: "Targets as a share of his touches: how much of his role is in the passing game." },
  ngs_eight_box_rate: { label: "Stacked boxes faced", tip: "Share of carries against eight or more defenders in the box (Next Gen)." },
  pfr_ybc_carry: { label: "Yards before contact", tip: "Yards before first contact per carry: mostly the line's work." },
  ngs_expected_ypc: { label: "Expected yards per carry", tip: "Next Gen's expected yards per carry from the defenders' positions: how blocked his runs were." },
  epa_carry: { label: "EPA per carry", tip: "EPA per carry. Repeats at 0.01 game to game." },
  ypc: { label: "Yards per carry", tip: "Rushing yards per carry." },
  yoe_carry: { label: "Yards over expected", tip: "Yards per carry above what the down, distance and field position usually allow." },
  rec_epa_target: { label: "EPA per target", tip: "Half the play's EPA per target." },
  fumble_rate: { label: "Fumble rate", tip: "Fumbles per touch." },
  short_yardage_conv: { label: "Short-yardage conversions", tip: "Third and fourth down with two or less to go, converted per carry." },
  ngs_efficiency: { label: "Efficiency", tip: "Next Gen's yards travelled per yard gained; lower means a straighter runner." },
};

export function traitLabel(trait: string, sport: GradeSport = "cfb"): { label: string; tip: string } {
  const base = TRAIT_LABELS[trait] ?? { label: trait, tip: "" };
  if (sport !== "nfl") return base;
  return RATED_MEASURE_LABELS[trait] ?? NFL_TRAIT_LABELS[trait] ?? base;
}

export function isMeasureKind(kind: string | null | undefined): kind is MeasureKind {
  return KIND_ORDER.includes(kind as MeasureKind);
}

export const UNIT_PREFIX = "unit:";

export function isUnitRow(athleteId: string): boolean {
  return athleteId.startsWith(UNIT_PREFIX);
}
