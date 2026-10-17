"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { GradedPlayer, PlayerIndexRow, PositionTraitRow } from "@/lib/position-grades";
import {
  KIND_LABELS,
  KIND_ORDER,
  POSITION_ORDER,
  RATING_LABELS,
  SPORT_COPY,
  isMeasureKind,
  isUnitRow,
  traitLabel,
  type GradeSport,
  type MeasureKind,
  type PositionGroup,
} from "@/lib/position-traits";
import { EMPTY, cn, formatNumber, formatSigned } from "@/lib/utils";
import { InfoTip } from "@/components/info-tip";
import { PlayerCell } from "@/components/player-cell";
import type { TeamLogoSource } from "@/components/team-logo";
import { ToggleGroup } from "@/components/toggle-group";

const PAGE_ROWS = 40;
const ALL = "all";

// A team's logos keyed by the same team string the trait rows carry: the
// school in college football, the franchise abbreviation in the NFL.
export interface GradeTeam extends TeamLogoSource {
  team: string;
}

// Diagonal stripes mark a trait inferred from unit outcomes or teammates
// rather than counted from the player's own tagged plays.
const INFERRED_FILL = {
  backgroundImage:
    "repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in oklch, var(--background) 45%, transparent) 3px 6px)",
};

// One trait line: the rows of a position's cards, in display order, with the
// kind each belongs to so the card can head each section once.
interface TraitLine {
  name: string;
  kind: MeasureKind | null;
}

function TraitRow({
  sport,
  name,
  group,
  trait,
}: {
  sport: GradeSport;
  name: string;
  group: string;
  trait: PositionTraitRow | undefined;
}) {
  const { label, tip } = traitLabel(name, sport);
  const inGrade = trait?.in_grade ?? false;
  const inferred = trait?.kind === "inferred";
  const kind = isMeasureKind(trait?.kind) ? trait.kind : null;
  const style = kind === "style" || kind === "role";
  const noise = kind === "noise";
  const reliability = trait?.reliability ?? null;
  const pct = trait?.percentile ?? null;
  const detail = trait == null
    ? `${tip} No value for this player yet.`
    : kind != null
      ? `${tip}${reliability != null ? ` Game-to-game reliability ${formatNumber(reliability, 2)}.` : ""}${inGrade ? " Carries weight in the rating." : style ? " Shown as a trait, not ranked by merit." : noise ? " Shown for reference only; it does not repeat." : " Carries no weight in the rating."}`
      : inGrade
        ? tip
        : `${tip} This trait is shown for context: it carries no weight in the ${group} grade because it was noise from game to game, stayed with the old team when players moved, or could not be measured.`;
  const dimmed = kind != null ? noise : !inGrade;
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,15rem)_1fr_2.25rem] items-center gap-2.5 text-xs",
        dimmed && "text-muted-foreground"
      )}
    >
      <span className="flex min-w-0 items-center justify-between gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{label}</span>
          <InfoTip
            text={`${detail}${trait?.value != null ? ` Raw value ${formatNumber(trait.value, 3)}.` : ""}`}
            label={`What is ${label}?`}
          />
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {reliability != null && (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground" title="Game-to-game reliability">
              r {formatNumber(reliability, 2)}
            </span>
          )}
          <span
            className={cn(
              "w-10 rounded-sm px-1 text-center font-mono text-[9px] uppercase tracking-wider",
              inGrade ? "bg-muted text-positive" : "invisible"
            )}
          >
            grade
          </span>
        </span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-[1px] bg-grid">
        <span
          className={cn(
            "block h-full",
            inferred ? "bg-accent-blue" : style ? "bg-muted-foreground" : "bg-primary",
            dimmed && "opacity-40"
          )}
          style={{ width: `${pct ?? 0}%`, ...(inferred ? INFERRED_FILL : {}) }}
        />
      </span>
      <span className="text-right font-mono tabular-nums">{pct == null ? EMPTY : Math.round(pct)}</span>
    </div>
  );
}

function Identity({ row, logo }: { row: PlayerIndexRow; logo: TeamLogoSource | undefined }) {
  if (isUnitRow(row.athleteId)) {
    return (
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-xs text-muted-foreground"
        >
          OL
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium">{row.team} offensive line</div>
          <div className="text-xs text-muted-foreground">unit · {formatNumber(row.games, 0)} games</div>
        </div>
      </div>
    );
  }
  return (
    <PlayerCell
      athleteId={row.athleteId}
      headshotUrl={row.headshotUrl}
      name={row.name}
      team={row.team}
      position={`${formatNumber(row.games, 0)} games`}
      logo={logo}
    />
  );
}

function Headline({
  label,
  tip,
  tipLabel,
  value,
  sub,
  positive,
  width,
}: {
  label: string;
  tip: string;
  tipLabel: string;
  value: string;
  sub: string;
  positive?: boolean;
  width: string;
}) {
  return (
    <div className={cn("flex flex-col items-end", width)}>
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label} <InfoTip text={tip} label={tipLabel} />
      </span>
      <span className={cn("font-mono text-xl font-bold tabular-nums leading-tight", positive && "text-positive")}>{value}</span>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{sub}</span>
    </div>
  );
}

function GradeCard({
  sport,
  rank,
  row,
  player,
  lines,
  logo,
}: {
  sport: GradeSport;
  rank: number;
  row: PlayerIndexRow;
  player: GradedPlayer | undefined;
  lines: TraitLine[];
  logo: TeamLogoSource | undefined;
}) {
  const copy = SPORT_COPY[sport];
  const grade = player?.grade ?? row.grade;
  const rating = RATING_LABELS[row.positionGroup];
  const rated = rating != null && player?.rating != null;
  const sections: { kind: MeasureKind | null; names: string[] }[] = [];
  for (const line of lines) {
    const last = sections[sections.length - 1];
    if (last && last.kind === line.kind) last.names.push(line.name);
    else sections.push({ kind: line.kind, names: [line.name] });
  }
  return (
    <article className="space-y-2 border-t border-rule-strong pt-3 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">{rank}</span>
          <Identity row={row} logo={logo} />
        </div>
        <div className="flex shrink-0 gap-3 text-right">
          <Headline
            label="grade"
            tip={rated ? rating.tip : copy.gradeTip}
            tipLabel="What is the grade?"
            value={grade == null ? EMPTY : formatNumber(grade, 1)}
            sub={
              grade == null
                ? "no grade at this position"
                : `±${formatNumber(player?.uncertainty, 1)} · pct ${row.percentile == null ? EMPTY : Math.round(row.percentile)}`
            }
            width="w-28"
          />
          {rated && (
            <Headline
              label={rating.label}
              tip={rating.tip}
              tipLabel="What is the forecast?"
              value={formatSigned(player.rating, 2)}
              sub={`${rating.unit}${player.ratingRange != null ? ` · range ±${formatNumber(player.ratingRange, 0)}` : ""}`}
              positive={player.rating != null && player.rating > 0}
              width="w-32"
            />
          )}
          <Headline
            label="WAR"
            tip={copy.warTip}
            tipLabel="What is wins above replacement?"
            value={player?.war == null ? EMPTY : formatSigned(player.war, 2)}
            sub={
              player == null
                ? "loading"
                : player.pointsAboveReplacement == null
                  ? "no credited plays"
                  : `${formatSigned(player.pointsAboveReplacement, 0)} pts`
            }
            positive={player?.war != null && player.war > 0}
            width="w-24"
          />
        </div>
      </div>
      {player && (
        <div className="space-y-2">
          {sections.map((section) => (
            <div key={section.kind ?? "traits"} className="space-y-1.5">
              {section.kind && (
                <div className="flex items-center gap-1.5 pt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {KIND_LABELS[section.kind].label}
                  <InfoTip text={KIND_LABELS[section.kind].tip} label={`What are ${KIND_LABELS[section.kind].label} measures?`} />
                </div>
              )}
              {section.names.map((name) => (
                <TraitRow
                  key={name}
                  sport={sport}
                  name={name}
                  group={row.positionGroup}
                  trait={player.traits.find((t) => t.trait === name)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function PositionGrades({
  sport,
  season,
  index,
  details,
  gradedCounts,
  teams,
}: {
  sport: GradeSport;
  season: number;
  index: PlayerIndexRow[];
  details: Record<string, GradedPlayer>;
  gradedCounts: Record<string, number>;
  teams: GradeTeam[];
}) {
  const copy = SPORT_COPY[sport];
  const positions = POSITION_ORDER.filter((key) => index.some((row) => row.positionGroup === key)).map((key) => ({
    key,
    label: key,
  }));
  const [position, setPosition] = useState<PositionGroup>(positions[0]?.key ?? "QB");
  const [group, setGroup] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim().toLowerCase());
  const [loaded, setLoaded] = useState<Record<string, GradedPlayer>>(details);

  const groups = useMemo(() => {
    const names = new Set<string>();
    for (const row of index) if (row.group) names.add(row.group);
    return [{ key: ALL, label: copy.groupLabel }, ...[...names].sort().map((name) => ({ key: name, label: name }))];
  }, [index, copy.groupLabel]);
  const logoFor = useMemo(() => {
    const byName = new Map(teams.map((t) => [t.team, t] as const));
    return (team: string) => byName.get(team);
  }, [teams]);

  // A search runs across every position; otherwise the list is one position.
  const matches = useMemo(
    () =>
      index.filter(
        (row) =>
          (search ? row.name.toLowerCase().includes(search) || row.team.toLowerCase().includes(search) : row.positionGroup === position) &&
          (group === ALL || row.group === group)
      ),
    [index, search, position, group]
  );
  const visible = matches.slice(0, PAGE_ROWS);

  useEffect(() => {
    const missing = visible.filter((row) => !loaded[row.athleteId]).map((row) => row.athleteId);
    if (missing.length === 0) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ season: String(season), ids: missing.join(",") });
    fetch(`${copy.apiPath}?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { players?: Record<string, GradedPlayer> } | null) => {
        if (body?.players) setLoaded((prev) => ({ ...prev, ...body.players }));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [visible, loaded, season, copy.apiPath]);

  // The same rows on every card at a position, taken from every loaded player
  // of that position. A fitted rating's measures sit in sections by kind,
  // weighted measures first, then the most reliable; the older traits sit
  // weighted first, then alphabetical.
  const linesFor = useMemo(() => {
    const byGroup = new Map<string, Map<string, { inGrade: boolean; kind: MeasureKind | null; reliability: number }>>();
    for (const row of index) {
      const player = loaded[row.athleteId];
      if (!player) continue;
      const names = byGroup.get(row.positionGroup) ?? new Map();
      for (const t of player.traits) {
        const seen = names.get(t.trait);
        names.set(t.trait, {
          inGrade: (seen?.inGrade ?? false) || t.in_grade,
          kind: isMeasureKind(t.kind) ? t.kind : null,
          reliability: Math.max(seen?.reliability ?? -1, t.reliability ?? -1),
        });
      }
      byGroup.set(row.positionGroup, names);
    }
    return (positionGroup: string): TraitLine[] =>
      [...(byGroup.get(positionGroup) ?? new Map()).entries()]
        .sort(([a, x], [b, y]) => {
          const kindRank = (k: MeasureKind | null) => (k == null ? -1 : KIND_ORDER.indexOf(k));
          return (
            kindRank(x.kind) - kindRank(y.kind) ||
            Number(y.inGrade) - Number(x.inGrade) ||
            y.reliability - x.reliability ||
            a.localeCompare(b)
          );
        })
        .map(([name, meta]) => ({ name, kind: meta.kind }));
  }, [index, loaded]);
  const graded = gradedCounts[position] ?? 0;

  return (
    <div className="space-y-section">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup label="Position" options={positions} value={position} onChange={setPosition} />
        <select
          aria-label={copy.groupLabel}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="h-8 border border-input bg-transparent px-2 font-mono text-xs"
        >
          {groups.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player or team"
          aria-label="Search player or team"
          className="h-8 w-56 border border-input bg-transparent px-2 text-sm"
        />
      </div>
      <p className="max-w-4xl text-sm text-muted-foreground leading-relaxed">
        {search
          ? `${matches.length} player${matches.length === 1 ? "" : "s"} match “${query.trim()}”${group === ALL ? "" : ` in the ${group}`}, best grade first.`
          : `Top ${visible.length} of ${matches.length} ${group === ALL ? "" : `${group} `}${position}, ${graded} graded this week.`}{" "}
        Every bar is a percentile among {copy.pool}{" "}at the position this week: gold bars are counted
        from the player&apos;s own tagged plays or box score, striped blue bars are inferred from unit outcomes
        or teammates, grey bars rank a style trait rather than merit, and dimmed lines carry no weight in the grade.
        The r beside a measure is how well it repeats from a player&apos;s odd games to his even games.
      </p>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players match.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
          {visible.map((row, i) => (
            <GradeCard
              key={row.athleteId}
              sport={sport}
              rank={i + 1}
              row={row}
              player={loaded[row.athleteId]}
              lines={linesFor(row.positionGroup)}
              logo={logoFor(row.team)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
