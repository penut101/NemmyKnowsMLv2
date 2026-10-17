"use client";

import { Fragment, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { OutlookYear, PlayerDetail, PlayerTrait, PlayerValueIndex } from "@/lib/mlb-players";
import {
  GRADE_TIP,
  IMPACT_TIP,
  MARKET_VALUE_TIP,
  MLB_POSITION_ORDER,
  OUTLOOK_TIP,
  PANEL_LABELS,
  PITCHER_GROUPS,
  PLAYING_TIME_TIP,
  PRICE_TIP,
  TRADE_VALUE_TIP,
  formatMillions,
  inputLabel,
  traitLabel,
} from "@/lib/player-values";
import { mlbTeamIdentity } from "@/lib/mlb-teams";
import { EMPTY, cn, formatNumber, formatSigned } from "@/lib/utils";
import { InfoTip } from "@/components/info-tip";
import { PlayerCell } from "@/components/player-cell";
import { ToggleGroup } from "@/components/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_ROWS = 40;
const ALL = "all";
const PRESETS = [
  { key: "best", label: "Best" },
  { key: "bargain", label: "Bargain" },
] as const;
type Preset = (typeof PRESETS)[number]["key"];

type SortKey =
  | "grade"
  | "value"
  | "age"
  | "projected_war"
  | "per_war"
  | "control_years"
  | "salary"
  | "impact"
  | "bat"
  | "fld";

// Diagonal stripes mark a physical measurement (sprint speed, bat speed,
// velocity, arm strength) rather than a rate counted from his plays.
const PHYSICAL_FILL = {
  backgroundImage:
    "repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in oklch, var(--background) 45%, transparent) 3px 6px)",
};

// A player with no control years is shopped at his market value for one season.
function headlineValue(row: PlayerValueIndex): { label: string; value: number | null; tip: string } {
  if (row.control_years === 0 || row.contract_status === "free_agent") {
    return { label: "Market value", value: row.market_value_musd, tip: MARKET_VALUE_TIP };
  }
  return { label: "Trade value", value: row.trade_value_musd, tip: TRADE_VALUE_TIP };
}

function perWar(row: PlayerValueIndex): number | null {
  if (row.salary_current_musd == null || row.projected_war == null || row.projected_war <= 0.05) return null;
  return row.salary_current_musd / row.projected_war;
}

// The panel grade shown in the table: the mean grade of the panel's weighted
// traits, so a hitter's Batting and a pitcher's Stuff read at a glance.
function panelGrade(detail: PlayerDetail | undefined, panel: string, trait?: string): number | null {
  if (!detail) return null;
  if (trait) return detail.traits.find((t) => t.trait === trait)?.grade ?? null;
  const graded = detail.traits.filter((t) => t.panel === panel && t.in_grade && t.grade != null);
  if (graded.length === 0) return null;
  return graded.reduce((sum, t) => sum + (t.grade ?? 0), 0) / graded.length;
}

function sortValue(row: PlayerValueIndex, detail: PlayerDetail | undefined, key: SortKey): number | null {
  const pitcher = PITCHER_GROUPS.has(row.position_group);
  switch (key) {
    case "grade":
      return row.grade;
    case "value":
      return headlineValue(row).value;
    case "age":
      return row.age;
    case "projected_war":
      return row.projected_war;
    case "per_war":
      return perWar(row);
    case "control_years":
      return row.control_years;
    case "salary":
      return row.salary_current_musd;
    case "impact":
      return row.impact_war;
    case "bat":
      return pitcher ? panelGrade(detail, "arsenal", "stuff") : panelGrade(detail, "batting");
    case "fld":
      return pitcher ? panelGrade(detail, "arsenal", "command") : panelGrade(detail, "fielding");
  }
}

function GradeBar({ grade }: { grade: number | null }) {
  const width = grade == null ? 0 : ((grade - 20) / 60) * 100;
  return (
    <span className="inline-block h-1.5 w-14 overflow-hidden rounded-[1px] bg-grid align-middle">
      <span className="block h-full bg-primary" style={{ width: `${width}%` }} />
    </span>
  );
}

function TraitRow({ trait }: { trait: PlayerTrait }) {
  const { label, tip } = traitLabel(trait.trait);
  const physical = trait.kind === "physical";
  const inputs = trait.inputs
    .map(([name, weight, value, pct]) => {
      const meta = inputLabel(name);
      return `${meta.label}${weight > 0 ? ` (weight ${weight.toFixed(2)})` : ""}: ${formatNumber(value, Math.abs(value) < 1 ? 3 : 1)}${pct == null ? "" : `, ${Math.round(pct)}th pct`}`;
    })
    .join("; ");
  const detail = trait.grade == null
    ? `${tip} Not enough data for this player.`
    : trait.in_grade
      ? tip
      : `${tip} Shown for context: it carries no weight in the Grade.`;
  const text = `${detail}${inputs ? ` Inputs: ${inputs}.` : ""}${trait.sample ? ` Sample ${trait.sample}.` : ""}${trait.grade != null ? ` Band ${formatNumber(trait.grade_low, 0)} to ${formatNumber(trait.grade_high, 0)}.` : ""}`;
  return (
    <div className={cn("grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2.5 text-xs", !trait.in_grade && "text-muted-foreground")}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{label}</span>
        <InfoTip text={text} label={`What is ${label}?`} />
      </span>
      <span className="h-1.5 overflow-hidden rounded-[1px] bg-grid">
        <span
          className={cn("block h-full", physical ? "bg-accent-blue" : "bg-primary", !trait.in_grade && "opacity-40")}
          style={{ width: `${trait.percentile ?? 0}%`, ...(physical ? PHYSICAL_FILL : {}) }}
        />
      </span>
      <span className="text-right font-mono tabular-nums">{trait.grade == null ? EMPTY : Math.round(trait.grade)}</span>
    </div>
  );
}

function OutlookTile({ year, graded }: { year: OutlookYear; graded: boolean }) {
  const faded = !year.in_control && year.salary_kind !== "buyout";
  return (
    <div className={cn("rounded-sm border border-border px-2 py-1.5 text-center font-mono text-[11px]", faded && "opacity-45")}>
      <div className="text-muted-foreground">{year.season} · {year.age}</div>
      <div className="font-bold text-primary">{graded && year.war != null ? `${formatNumber(year.war, 1)} WAR` : EMPTY}</div>
      <div className="text-muted-foreground">
        {faded ? "free agent" : `${formatMillions(year.salary_musd)} ${year.salary_kind === "pre_arb" ? "min" : year.salary_kind === "arbitration" ? "arb" : year.salary_kind === "option" ? "opt" : year.salary_kind === "buyout" ? "buyout" : ""}`}
      </div>
      <div className={cn("font-bold", (year.surplus_musd ?? 0) >= 0 ? "text-positive" : "text-destructive")}>
        {faded || !graded || year.surplus_musd == null ? EMPTY : formatSigned(year.surplus_musd, 1).replace(/^([+-])/, "$1$")}M
      </div>
    </div>
  );
}

function PlayerCard({ row, detail }: { row: PlayerValueIndex; detail: PlayerDetail | undefined }) {
  const graded = row.grade != null;
  const head = headlineValue(row);
  const pitcher = PITCHER_GROUPS.has(row.position_group);
  const panels = pitcher ? ["arsenal", "results", "durability"] : ["batting", "fielding"];
  const tip = detail?.tip ?? {};
  const components = graded
    ? ` Components: projected ${formatNumber(tip.projected_runs as number, 1)} runs above average per full season, positional ${formatSigned(tip.positional_adjustment as number, 1)}, replacement ${formatNumber(tip.replacement_runs as number, 1)}, playing time ${formatNumber(tip.playing_time as number, 0)}, ${formatNumber(tip.runs_per_win as number, 2)} runs per win, price ${formatMillions(tip.price_per_win_musd as number)} per win (${tip.price_source ?? ""}), discount ${tip.discount ?? ""}.`
    : "";
  return (
    <div className="space-y-4 py-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span>{row.bats ?? "?"}/{row.throws ?? "?"}</span>
        {row.secondary_positions.length > 0 && <span>also {row.secondary_positions.join(", ")}</span>}
        {row.service_time != null && <span>service {formatNumber(row.service_time, 3)}</span>}
        {row.fa_year != null && <span>free agent {row.fa_year}</span>}
        {row.contract_status === "estimated" && <span>contract estimated from debut date</span>}
        {row.contract_status === "unknown" && <span>contract not found</span>}
        {row.owed_through_control_musd != null && row.control_years > 0 && (
          <span>owed {formatMillions(row.owed_through_control_musd)} over {row.control_years} control year{row.control_years === 1 ? "" : "s"}</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Grade <InfoTip text={`${GRADE_TIP}${components}`} label="What is the Grade?" />
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums text-primary">{graded ? formatNumber(row.grade, 0) : EMPTY}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {graded ? `${formatNumber(row.grade_low, 0)} to ${formatNumber(row.grade_high, 0)} · ${Math.round(row.grade_percentile ?? 0)}th pct · ${row.position_group}` : "Not enough data"}
          </div>
        </div>
        <div>
          <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {head.label} <InfoTip text={`${head.tip} ${PRICE_TIP}`} label={`What is ${head.label}?`} />
          </div>
          <div className={cn("font-mono text-2xl font-bold tabular-nums", (head.value ?? 0) >= 0 ? "text-positive" : "text-destructive")}>
            {graded ? formatMillions(head.value) : EMPTY}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {!graded
              ? "Not enough data"
              : head.label === "Trade value" && row.trade_value_low != null
                ? `${formatMillions(row.trade_value_low)} to ${formatMillions(row.trade_value_high)} · ${row.control_years} yrs`
                : `${formatNumber(row.projected_war, 1)} projected WAR`}
          </div>
        </div>
        <div>
          <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Impact <InfoTip text={IMPACT_TIP} label="What is Impact?" />
          </div>
          <div className="font-mono text-2xl font-bold tabular-nums">{row.impact_war == null ? EMPTY : formatSigned(row.impact_war, 1)}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {row.impact_runs == null ? "no plate appearances" : `${formatSigned(row.impact_runs, 1)} runs · ${row.season - 1} season`}
          </div>
        </div>
      </div>
      {detail == null ? (
        <p className="text-xs text-muted-foreground">Loading traits…</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          {panels.map((panel) => {
            const traits = detail.traits.filter((t) => t.panel === panel).sort((a, b) => Number(b.in_grade) - Number(a.in_grade) || a.trait.localeCompare(b.trait));
            if (traits.length === 0) return null;
            return (
              <div key={panel} className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>{PANEL_LABELS[panel] ?? panel}</span>
                  <span className="font-mono">{formatNumber(panelGrade(detail, panel), 0)}</span>
                </div>
                {traits.map((t) => (
                  <TraitRow key={t.trait} trait={t} />
                ))}
              </div>
            );
          })}
        </div>
      )}
      {detail != null && detail.outlook.length > 0 && (
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Control-year outlook <InfoTip text={`${OUTLOOK_TIP} ${PLAYING_TIME_TIP}`} label="What is the outlook?" />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {detail.outlook.map((year) => (
              <OutlookTile key={year.season} year={year} graded={graded} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  tip,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  tip?: string;
  className?: string;
}) {
  return (
    <TableHead className={cn("whitespace-nowrap", className)} aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}
      >
        {label}
        {active && <span aria-hidden="true">{dir === "desc" ? "▼" : "▲"}</span>}
      </button>
      {tip && <InfoTip text={tip} label={`What is ${label}?`} className="ml-1" />}
    </TableHead>
  );
}

export default function MlbPlayerValues({ index }: { index: PlayerValueIndex[] }) {
  const positions = MLB_POSITION_ORDER.filter((key) => index.some((row) => row.position_group === key)).map((key) => ({ key, label: key }));
  const [position, setPosition] = useState<string>(positions[0]?.key ?? "C");
  const [preset, setPreset] = useState<Preset>("best");
  const [sortKey, setSortKey] = useState<SortKey>("grade");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [team, setTeam] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim().toLowerCase());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<Record<string, PlayerDetail>>({});

  const teams = useMemo(() => {
    const names = new Set<string>();
    for (const row of index) if (row.team) names.add(row.team);
    return [{ key: ALL, label: "All teams" }, ...[...names].sort().map((name) => ({ key: name, label: name }))];
  }, [index]);

  const choosePreset = (key: Preset) => {
    setPreset(key);
    setSortKey(key === "best" ? "grade" : "value");
    setSortDir("desc");
  };
  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir(key === "age" || key === "per_war" ? "asc" : "desc");
    }
  };

  const pitcherList = PITCHER_GROUPS.has(position);
  const matches = useMemo(() => {
    const rows = index.filter(
      (row) =>
        (search ? (row.player_name ?? "").toLowerCase().includes(search) || (row.team ?? "").toLowerCase().includes(search) : row.position_group === position) &&
        (team === ALL || row.team === team)
    );
    const sign = sortDir === "desc" ? -1 : 1;
    return rows.sort((a, b) => {
      const va = sortValue(a, loaded[String(a.player_id)], sortKey);
      const vb = sortValue(b, loaded[String(b.player_id)], sortKey);
      if (va == null && vb == null) return (b.grade ?? -1) - (a.grade ?? -1);
      if (va == null) return 1;
      if (vb == null) return -1;
      return sign * (va - vb) || (b.grade ?? -1) - (a.grade ?? -1);
    });
  }, [index, search, position, team, sortKey, sortDir, loaded]);
  const visible = matches.slice(0, PAGE_ROWS);

  useEffect(() => {
    const missing = visible.filter((row) => !loaded[String(row.player_id)]).map((row) => row.player_id);
    if (missing.length === 0) return;
    const controller = new AbortController();
    fetch(`/mlb/api/player-details?ids=${missing.join(",")}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { players?: Record<string, PlayerDetail> } | null) => {
        if (body?.players) setLoaded((prev) => ({ ...prev, ...body.players }));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [visible, loaded]);

  const graded = matches.filter((row) => row.grade != null).length;

  return (
    <div className="space-y-section">
      <div className="flex flex-wrap items-center gap-3">
        {/* Eleven positions overflow a phone, so small screens get one select beside the team select. */}
        <div className="hidden md:block">
          <ToggleGroup label="Position" options={positions} value={position} onChange={(key) => { setPosition(key); setExpanded(null); }} />
        </div>
        <select
          aria-label="Position"
          value={position}
          onChange={(e) => { setPosition(e.target.value); setExpanded(null); }}
          className="h-8 border border-input bg-transparent px-2 font-mono text-xs md:hidden"
        >
          {positions.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
        <ToggleGroup label="Sort" options={PRESETS} value={preset} onChange={choosePreset} variant="pill" />
        <select aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)} className="h-8 border border-input bg-transparent px-2 font-mono text-xs">
          {teams.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player or team"
          aria-label="Search player or team"
          className="h-8 w-full border border-input bg-transparent px-2 text-sm sm:w-56"
        />
      </div>
      <p className="max-w-4xl text-sm text-muted-foreground leading-relaxed">
        {search
          ? `${matches.length} player${matches.length === 1 ? "" : "s"} match “${query.trim()}”.`
          : `Top ${visible.length} of ${matches.length} ${position}, ${graded} graded.`}{" "}
        Best sorts by Grade, what the Dodgers want. Bargain sorts by Trade value, the gap between what a player
        will produce over his control years and what he is owed. Click a row for the card.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">#</TableHead>
            <TableHead className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Player</TableHead>
            <SortHeader label="Age" sortKey="age" active={sortKey === "age"} dir={sortDir} onSort={onSort} />
            <SortHeader label="Grade" sortKey="grade" active={sortKey === "grade"} dir={sortDir} onSort={onSort} tip={GRADE_TIP} />
            <SortHeader label={pitcherList ? "Stuff" : "Bat"} sortKey="bat" active={sortKey === "bat"} dir={sortDir} onSort={onSort} className="hidden md:table-cell" />
            <SortHeader label={pitcherList ? "Cmd" : "Fld"} sortKey="fld" active={sortKey === "fld"} dir={sortDir} onSort={onSort} className="hidden md:table-cell" />
            <SortHeader label="Value" sortKey="value" active={sortKey === "value"} dir={sortDir} onSort={onSort} tip={`${TRADE_VALUE_TIP} ${MARKET_VALUE_TIP}`} className="text-right" />
            <SortHeader label="Proj WAR" sortKey="projected_war" active={sortKey === "projected_war"} dir={sortDir} onSort={onSort} className="hidden text-right lg:table-cell" />
            <SortHeader label="$/WAR" sortKey="per_war" active={sortKey === "per_war"} dir={sortDir} onSort={onSort} tip="Next season's salary divided by projected WAR. Lower is cheaper." className="hidden text-right lg:table-cell" />
            <SortHeader label="Ctrl" sortKey="control_years" active={sortKey === "control_years"} dir={sortDir} onSort={onSort} tip="Seasons of team control left, including options the team would exercise." className="hidden text-right sm:table-cell" />
            <SortHeader label="Salary" sortKey="salary" active={sortKey === "salary"} dir={sortDir} onSort={onSort} tip="Next season's salary: the contract figure, or the estimated arbitration award or league minimum." className="hidden text-right sm:table-cell" />
            <SortHeader label="Impact" sortKey="impact" active={sortKey === "impact"} dir={sortDir} onSort={onSort} tip={IMPACT_TIP} className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="text-sm text-muted-foreground">No players match.</TableCell>
            </TableRow>
          ) : (
            visible.map((row, i) => {
              const detail = loaded[String(row.player_id)];
              const head = headlineValue(row);
              const open = expanded === row.player_id;
              const pitcher = PITCHER_GROUPS.has(row.position_group);
              const bat = pitcher ? panelGrade(detail, "arsenal", "stuff") : panelGrade(detail, "batting");
              const fld = pitcher ? panelGrade(detail, "arsenal", "command") : panelGrade(detail, "fielding");
              const ratio = perWar(row);
              return (
                <Fragment key={row.player_id}>
                  <TableRow
                    onClick={() => setExpanded(open ? null : row.player_id)}
                    aria-expanded={open}
                    className={cn("cursor-pointer", open && "bg-muted/40")}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="min-w-48">
                      <PlayerCell
                        athleteId={String(row.player_id)}
                        headshotUrl={row.headshot_url}
                        name={row.player_name ?? String(row.player_id)}
                        team={row.team || "FA"}
                        position={row.position_group}
                        logo={mlbTeamIdentity(row.team)}
                      />
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">{row.age ?? EMPTY}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono tabular-nums">
                      {row.grade == null ? (
                        <span className="text-xs text-muted-foreground">Not enough data</span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-bold text-primary">{formatNumber(row.grade, 0)}</span>
                          <GradeBar grade={row.grade} />
                          <span className="text-[11px] text-muted-foreground">{formatNumber(row.grade_low, 0)}–{formatNumber(row.grade_high, 0)}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-mono tabular-nums md:table-cell">{bat == null ? EMPTY : Math.round(bat)}</TableCell>
                    <TableCell className="hidden font-mono tabular-nums md:table-cell">{fld == null ? EMPTY : Math.round(fld)}</TableCell>
                    <TableCell className={cn("whitespace-nowrap text-right font-mono font-bold tabular-nums", row.grade == null ? "text-muted-foreground" : (head.value ?? 0) >= 0 ? "text-positive" : "text-destructive")}>
                      {row.grade == null ? EMPTY : formatMillions(head.value)}
                      {row.grade != null && head.label === "Market value" && <span className="ml-1 font-normal text-[10px] uppercase text-muted-foreground"> mkt</span>}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums lg:table-cell">{formatNumber(row.projected_war, 1)}</TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums lg:table-cell">{ratio == null ? EMPTY : formatMillions(ratio)}</TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{row.control_years}</TableCell>
                    <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">{formatMillions(row.salary_current_musd)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{row.impact_war == null ? EMPTY : formatSigned(row.impact_war, 1)}</TableCell>
                  </TableRow>
                  {open && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={12} className="bg-muted/20">
                        <PlayerCard row={row} detail={detail} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
