"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { CfbGradedPlayer, CfbPlayerIndexRow } from "@/lib/cfb";
import type { CfbPositionTrait, CfbTeamIdentity } from "@/lib/types";
import {
  GRADE_TIP,
  POSITION_ORDER,
  WAR_TIP,
  isUnitRow,
  traitLabel,
  type PositionGroup,
} from "@/lib/position-traits";
import { EMPTY, cn, formatNumber, formatSigned } from "@/lib/utils";
import { InfoTip } from "@/components/info-tip";
import { PlayerCell } from "@/components/player-cell";
import { ToggleGroup } from "@/components/toggle-group";

const PAGE_ROWS = 40;
const ALL = "all";

// Diagonal stripes mark a trait inferred from unit outcomes or teammates
// rather than counted from the player's own tagged plays.
const INFERRED_FILL = {
  backgroundImage:
    "repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in oklch, var(--background) 45%, transparent) 3px 6px)",
};

function TraitRow({
  name,
  group,
  trait,
}: {
  name: string;
  group: string;
  trait: CfbPositionTrait | undefined;
}) {
  const { label, tip } = traitLabel(name);
  const inGrade = trait?.in_grade ?? false;
  const inferred = trait?.kind === "inferred";
  const pct = trait?.percentile ?? null;
  const detail = trait == null
    ? `${tip} No value for this player yet.`
    : inGrade
      ? tip
      : `${tip} This trait is shown for context: it carries no weight in the ${group} grade because it was noise from game to game, stayed with the old team when players transferred, or could not be measured.`;
  return (
    <div
      className={cn(
        "grid grid-cols-[12rem_1fr_2.25rem] items-center gap-2.5 text-xs",
        !inGrade && "text-muted-foreground"
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
        <span
          className={cn(
            "w-11 shrink-0 rounded-sm px-1 text-center font-mono text-[10px] uppercase tracking-wider",
            inGrade ? "bg-muted text-positive" : "invisible"
          )}
        >
          grade
        </span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-[1px] bg-grid">
        <span
          className={cn("block h-full", inferred ? "bg-accent-blue" : "bg-primary", !inGrade && "opacity-40")}
          style={{ width: `${pct ?? 0}%`, ...(inferred ? INFERRED_FILL : {}) }}
        />
      </span>
      <span className="text-right font-mono tabular-nums">{pct == null ? EMPTY : Math.round(pct)}</span>
    </div>
  );
}

function Identity({
  athleteId,
  name,
  team,
  games,
  logo,
}: {
  athleteId: string;
  name: string;
  team: string;
  games: number | null;
  logo: CfbTeamIdentity | undefined;
}) {
  if (isUnitRow(athleteId)) {
    return (
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-muted font-mono text-xs text-muted-foreground"
        >
          OL
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium">{team} offensive line</div>
          <div className="text-xs text-muted-foreground">unit · {formatNumber(games, 0)} games</div>
        </div>
      </div>
    );
  }
  return (
    <PlayerCell athleteId={athleteId} name={name} team={team} position={`${formatNumber(games, 0)} games`} logo={logo} />
  );
}

function GradeCard({
  rank,
  row,
  player,
  traitNames,
  logo,
}: {
  rank: number;
  row: CfbPlayerIndexRow;
  player: CfbGradedPlayer | undefined;
  traitNames: string[];
  logo: CfbTeamIdentity | undefined;
}) {
  const grade = player?.grade ?? row.grade;
  return (
    <article className="space-y-2 border-t border-rule-strong pt-3 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">{rank}</span>
          <Identity athleteId={row.athleteId} name={row.name} team={row.team} games={row.games} logo={logo} />
        </div>
        <div className="flex shrink-0 gap-3 text-right">
          <div className="flex w-28 flex-col items-end">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              grade <InfoTip text={GRADE_TIP} label="What is the grade?" />
            </span>
            <span className="font-mono text-xl font-bold tabular-nums leading-tight">
              {grade == null ? EMPTY : formatNumber(grade, 1)}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {grade == null
                ? "no grade at this position"
                : `±${formatNumber(player?.uncertainty, 1)} · pct ${row.percentile == null ? EMPTY : Math.round(row.percentile)}`}
            </span>
          </div>
          <div className="flex w-24 flex-col items-end">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              WAR <InfoTip text={WAR_TIP} label="What is wins above replacement?" />
            </span>
            <span
              className={cn(
                "font-mono text-xl font-bold tabular-nums leading-tight",
                player?.war != null && player.war > 0 && "text-positive"
              )}
            >
              {player?.war == null ? EMPTY : formatSigned(player.war, 2)}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {player == null
                ? "loading"
                : player.pointsAboveReplacement == null
                  ? "no credited plays"
                  : `${formatSigned(player.pointsAboveReplacement, 0)} pts`}
            </span>
          </div>
        </div>
      </div>
      {player && (
        <div className="space-y-1.5">
          {traitNames.map((name) => (
            <TraitRow key={name} name={name} group={row.positionGroup} trait={player.traits.find((t) => t.trait === name)} />
          ))}
        </div>
      )}
    </article>
  );
}

export default function PositionGrades({
  season,
  index,
  details,
  gradedCounts,
  teams,
}: {
  season: number;
  index: CfbPlayerIndexRow[];
  details: Record<string, CfbGradedPlayer>;
  gradedCounts: Record<string, number>;
  teams: CfbTeamIdentity[];
}) {
  const positions = POSITION_ORDER.filter((key) => index.some((row) => row.positionGroup === key)).map((key) => ({
    key,
    label: key,
  }));
  const [position, setPosition] = useState<PositionGroup>(positions[0]?.key ?? "QB");
  const [conference, setConference] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim().toLowerCase());
  const [loaded, setLoaded] = useState<Record<string, CfbGradedPlayer>>(details);

  const conferences = useMemo(() => {
    const names = new Set<string>();
    for (const row of index) if (row.conference) names.add(row.conference);
    return [{ key: ALL, label: "All conferences" }, ...[...names].sort().map((name) => ({ key: name, label: name }))];
  }, [index]);
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
          (conference === ALL || row.conference === conference)
      ),
    [index, search, position, conference]
  );
  const visible = matches.slice(0, PAGE_ROWS);

  useEffect(() => {
    const missing = visible.filter((row) => !loaded[row.athleteId]).map((row) => row.athleteId);
    if (missing.length === 0) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ season: String(season), ids: missing.join(",") });
    fetch(`/cfb/api/player-traits?${params}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { players?: Record<string, CfbGradedPlayer> } | null) => {
        if (body?.players) setLoaded((prev) => ({ ...prev, ...body.players }));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [visible, loaded, season]);

  // The same rows on every card at a position: weighted traits first, then the
  // rest, taken from every loaded player of that position.
  const traitNamesFor = useMemo(() => {
    const byGroup = new Map<string, Map<string, boolean>>();
    for (const row of index) {
      const player = loaded[row.athleteId];
      if (!player) continue;
      const names = byGroup.get(row.positionGroup) ?? new Map<string, boolean>();
      for (const t of player.traits) names.set(t.trait, names.get(t.trait) || t.in_grade);
      byGroup.set(row.positionGroup, names);
    }
    return (group: string) =>
      [...(byGroup.get(group) ?? new Map<string, boolean>()).entries()]
        .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
        .map(([name]) => name);
  }, [index, loaded]);
  const graded = gradedCounts[position] ?? 0;

  return (
    <div className="space-y-section">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup label="Position" options={positions} value={position} onChange={setPosition} />
        <select
          aria-label="Conference"
          value={conference}
          onChange={(e) => setConference(e.target.value)}
          className="h-8 border border-input bg-transparent px-2 font-mono text-xs"
        >
          {conferences.map((option) => (
            <option key={option.key} value={option.key}>
              {option.key === ALL ? "Conference" : option.label}
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
          ? `${matches.length} player${matches.length === 1 ? "" : "s"} match “${query.trim()}”${conference === ALL ? "" : ` in the ${conference}`}, best grade first.`
          : `Top ${visible.length} of ${matches.length} ${conference === ALL ? "" : `${conference} `}${position}, ${graded} graded this week.`}{" "}
        Every bar is a percentile among qualified FBS players at the position this week: gold bars are counted
        from the player&apos;s own tagged plays or box score, striped blue bars are inferred from unit outcomes
        or teammates, and dimmed traits carry no weight in the grade.
      </p>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players match.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
          {visible.map((row, i) => (
            <GradeCard key={row.athleteId} rank={i + 1} row={row} player={loaded[row.athleteId]} traitNames={traitNamesFor(row.positionGroup)} logo={logoFor(row.team)} />
          ))}
        </div>
      )}
    </div>
  );
}
