// Display vocabulary for the MLB player valuation tables. The trait and input
// keys are mlbmodel's (v2/players/inputs.py and features.py) and must stay in
// step with them. Every number on the page explains itself from here; the
// tables carry only the numbers.

export const MLB_POSITION_ORDER = ["C", "1B", "2B", "SS", "3B", "LF", "CF", "RF", "DH", "SP", "RP"] as const;
export type MlbPositionGroup = (typeof MLB_POSITION_ORDER)[number];
export const PITCHER_GROUPS: ReadonlySet<string> = new Set(["SP", "RP"]);

export const GRADE_TIP =
  "A 20 to 80 scouting grade of projected true talent for a full season at his position. Skill measurements (swing decisions, contact quality, bat speed, pitch characteristics, range, speed) and a shrunk outcome record, combined with weights fitted on 2021 to 2025 to predict a player's own next-season runs. 50 is the average 40-man player at the position and 10 points is one standard deviation. The band is the noise at his sample size.";

export const TRADE_VALUE_TIP =
  "Projected production over his remaining control years at the market price of a win, minus what he is owed, discounted 8 percent a year. Pre-arbitration seasons pay the league minimum, arbitration seasons a fitted share of market value, guaranteed seasons their salary; options are exercised when they favor the side that holds them. The range comes from resampling his outcome record.";

export const MARKET_VALUE_TIP =
  "What his next season is worth on the open market: projected wins times the price of a win fitted from free-agent deals since 2024. Shown for players with no control years left.";

export const IMPACT_TIP =
  "Wins above replacement this season from what actually happened: his plate appearances valued by run expectancy, plus his fielding and baserunning runs, against a replacement-level player at his position. Descriptive, never projected.";

export const OUTLOOK_TIP =
  "One tile per remaining control year: his age, projected wins after the age curve, projected salary, and the year's surplus at the price of a win. Faded tiles are free-agent seasons shown for context.";

export const PLAYING_TIME_TIP =
  "Projected plate appearances (batters faced for pitchers) for a full season: his recent playing time shrunk toward the position norm and reduced by days lost to the injured list over three seasons.";

export const PRICE_TIP =
  "The price of a win is the slope of average annual value on projected wins across free-agent contracts signed since 2024, fitted to this model's own projections.";

export const PANEL_LABELS: Record<string, string> = {
  batting: "Batting",
  fielding: "Fielding and running",
  arsenal: "Arsenal",
  results: "Results",
  durability: "Durability",
};

export const TRAIT_LABELS: Record<string, { label: string; tip: string }> = {
  contact: { label: "Contact", tip: "How reliably he puts the bat on the ball, from his swings rather than his batting average." },
  power: { label: "Power", tip: "How hard and how far the ball leaves the bat when he connects, and how fast he swings." },
  discipline: { label: "Discipline", tip: "Which pitches he swings at: chasing out of the zone, attacking in it, and the walks that follow." },
  bbq: { label: "Batted-ball quality", tip: "What his contact is worth: expected wOBA on contact, launch angles in the sweet spot, pulled fly balls, grounders." },
  platoon: { label: "Platoon", tip: "How his production against left-handed pitching compares with his overall line." },
  range: { label: "Range", tip: "Outs above average at his primary position, split by direction." },
  arm: { label: "Arm", tip: "Throwing arm strength; for catchers, caught-stealing above average and pop time." },
  reliability: { label: "Reliability", tip: "For catchers: framing and blocking runs." },
  baserunning: { label: "Baserunning", tip: "Runs from taking extra bases and stealing, net of being thrown out." },
  speed: { label: "Sprint speed", tip: "Feet per second on his fastest runs. A physical measurement." },
  stuff: { label: "Stuff", tip: "Velocity, how far his secondary pitches move away from his fastball, pitch-level run value, and whiffs." },
  command: { label: "Command", tip: "Zone rate, first-pitch strikes, and the walks he allows." },
  batmiss: { label: "Bat-missing", tip: "Strikeouts, whiffs, and the chases he induces." },
  contactmgmt: { label: "Contact management", tip: "What hitters do when they connect: expected wOBA and barrels allowed, ground balls, home runs." },
  workload: { label: "Workload", tip: "Innings and pitches per outing, outings per month, and the leverage of his innings." },
};

export const INPUT_LABELS: Record<string, { label: string; tip: string }> = {
  "contact.whiff_rate": { label: "Whiff rate", tip: "Swings and misses per swing." },
  "contact.zone_contact_rate": { label: "Zone contact", tip: "Contact per swing at pitches in the strike zone." },
  "contact.squared_up_rate": { label: "Squared up", tip: "Batted balls carrying at least 80 percent of the exit velocity his bat and pitch speed allow." },
  "contact.k_rate": { label: "Strikeout rate", tip: "Strikeouts per plate appearance." },
  "power.barrel_rate": { label: "Barrel rate", tip: "Barrels per batted ball: 98 mph or more at the launch angles that carry." },
  "power.ev90": { label: "90th pct exit velocity", tip: "The exit velocity his hardest tenth of batted balls reach." },
  "power.hard_hit_rate": { label: "Hard-hit rate", tip: "Batted balls at 95 mph or more." },
  "power.bat_speed": { label: "Bat speed", tip: "Average bat speed on competitive swings, in mph." },
  "power.hard_swing_rate": { label: "Hard-swing rate", tip: "Competitive swings at 75 mph or more." },
  "power.hr_rate": { label: "Home run rate", tip: "Home runs per plate appearance." },
  "discipline.chase_rate": { label: "Chase rate", tip: "Swings at pitches outside the zone." },
  "discipline.zone_swing_rate": { label: "Zone swing rate", tip: "Swings at pitches in the zone." },
  "discipline.bb_rate": { label: "Walk rate", tip: "Walks per plate appearance." },
  "bbq.xwobacon": { label: "xwOBA on contact", tip: "Expected wOBA from exit velocity and launch angle, on batted balls." },
  "bbq.sweet_spot_rate": { label: "Sweet-spot rate", tip: "Batted balls launched between 8 and 32 degrees." },
  "bbq.pulled_fb_rate": { label: "Pulled fly balls", tip: "Fly balls and line drives pulled more than 15 degrees." },
  "bbq.gb_rate": { label: "Ground-ball rate", tip: "Ground balls per batted ball. Lower is better for a hitter." },
  "platoon.vs_lhp_delta": { label: "vs LHP delta", tip: "wOBA against left-handed pitching minus his overall wOBA." },
  "range.oaa_per_600": { label: "Outs above average", tip: "Outs above average at his primary position for the season." },
  "range.oaa_infront": { label: "In front", tip: "Outs above average on plays coming in." },
  "range.oaa_lateral": { label: "Lateral", tip: "Outs above average on plays to either side." },
  "range.oaa_behind": { label: "Behind", tip: "Outs above average on plays going back." },
  "arm.strength": { label: "Arm strength", tip: "Average of his hardest throws, in mph." },
  "arm.cs_above_average": { label: "Caught stealing above average", tip: "Runners caught beyond what the pitcher and runner speed predicted." },
  "arm.pop_time": { label: "Pop time", tip: "Seconds from catch to the fielder's glove on throws to second. Lower is better." },
  "reliability.blocking_runs": { label: "Blocking runs", tip: "Runs saved by blocking pitches in the dirt." },
  "reliability.framing_runs": { label: "Framing runs", tip: "Runs from called strikes gained on borderline pitches." },
  "baserunning.runs": { label: "Baserunning runs", tip: "Runs from extra bases taken and steals, net of outs." },
  "baserunning.sb_runs": { label: "Stolen-base runs", tip: "Runs from steals of second and third, net of being caught." },
  "speed.sprint_speed": { label: "Sprint speed", tip: "Feet per second on competitive runs." },
  "stuff.velo": { label: "Fastball velocity", tip: "Average four-seam and sinker velocity." },
  "stuff.movement_vs_fb": { label: "Movement separation", tip: "How far his secondary pitches break away from his fastball, in feet." },
  "stuff.arsenal_rv100": { label: "Arsenal run value", tip: "Run value per 100 pitches across his arsenal, from the pitcher's side." },
  "stuff.whiff_rate": { label: "Whiff rate", tip: "Swings and misses per swing against him." },
  "command.zone_rate": { label: "Zone rate", tip: "Pitches in the strike zone." },
  "command.first_pitch_strike": { label: "First-pitch strikes", tip: "First pitches that are strikes or put in play." },
  "command.bb_rate": { label: "Walk rate", tip: "Walks per batter faced." },
  "batmiss.k_rate": { label: "Strikeout rate", tip: "Strikeouts per batter faced." },
  "batmiss.chase_induced": { label: "Chases induced", tip: "Swings he draws at pitches outside the zone." },
  "contactmgmt.xwobacon_allowed": { label: "xwOBA on contact allowed", tip: "Expected wOBA on the batted balls he allows." },
  "contactmgmt.barrel_rate_allowed": { label: "Barrels allowed", tip: "Barrels per batted ball against him." },
  "contactmgmt.gb_rate": { label: "Ground-ball rate", tip: "Ground balls per batted ball against him." },
  "contactmgmt.hr_rate": { label: "Home runs allowed", tip: "Home runs per batter faced." },
  "workload.ip_per_outing": { label: "Innings per outing", tip: "Average innings per appearance." },
  "workload.pitches_per_outing": { label: "Pitches per outing", tip: "Average pitches per appearance." },
  "workload.outings_per_month": { label: "Outings per month", tip: "Appearances per month active." },
  "workload.leverage": { label: "Leverage", tip: "How much win probability moved on his pitches, relative to the league pitch." },
};

export function traitLabel(trait: string): { label: string; tip: string } {
  return TRAIT_LABELS[trait] ?? { label: trait, tip: "" };
}

export function inputLabel(name: string): { label: string; tip: string } {
  return INPUT_LABELS[name] ?? { label: name, tip: "" };
}

// Dollars in millions: "$61.5M", "-$12.0M".
export function formatMillions(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "–";
  const rounded = Number(value.toFixed(decimals));
  const text = `$${Math.abs(rounded).toFixed(decimals)}M`;
  return rounded < 0 ? `-${text}` : text;
}
