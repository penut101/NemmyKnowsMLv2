"use client";

import { useMemo, useState } from "react";
import type { CfbGradedPlayer } from "@/lib/cfb";
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

const POSITIONS = POSITION_ORDER.map((key) => ({ key, label: key }));

// Diagonal stripes mark a trait inferred from unit outcomes or teammates
// rather than counted from the player's own tagged plays.
const INFERRED_FILL = {
  backgroundImage:
    "repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in oklch, var(--background) 45%, transparent) 3px 6px)",
};

function TraitRow({ trait }: { trait: CfbPositionTrait }) {
  const { label, tip } = traitLabel(trait.trait);
  const inferred = trait.kind === "inferred";
  const pct = trait.percentile;
  const detail = trait.in_grade
    ? tip
    : `${tip} This trait is shown for context: it carries no weight in the ${trait.position_group} grade because it was noise from game to game, stayed with the old team when players transferred, or could not be measured.`;
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,11rem)_1fr_2.25rem] items-center gap-2.5 text-xs",
        !trait.in_grade && "text-muted-foreground"
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate">{label}</span>
        <InfoTip text={`${detail}${trait.value != null ? ` Raw value ${formatNumber(trait.value, 3)}.` : ""}`} label={`What is ${label}?`} />
        {trait.in_grade && (
          <span className="rounded-sm bg-muted px-1 font-mono text-[10px] uppercase tracking-wider text-positive">
            grade
          </span>
        )}
      </span>
      <span className="h-1.5 overflow-hidden rounded-[1px] bg-grid">
        <span
          className={cn(
            "block h-full",
            inferred ? "bg-accent-blue" : "bg-primary",
            !trait.in_grade && "opacity-40"
          )}
          style={{ width: `${pct ?? 0}%`, ...(inferred ? INFERRED_FILL : {}) }}
        />
      </span>
      <span className="text-right font-mono tabular-nums">{pct == null ? EMPTY : Math.round(pct)}</span>
    </div>
  );
}

function GradeCard({
  rank,
  player,
  logo,
}: {
  rank: number;
  player: CfbGradedPlayer;
  logo: CfbTeamIdentity | undefined;
}) {
  const unit = isUnitRow(player.athleteId);
  return (
    <article className="space-y-2 border-t border-rule-strong pt-3 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">{rank}</span>
          {unit ? (
            <div className="min-w-0">
              <div className="truncate font-medium">{player.team} offensive line</div>
              <div className="text-xs text-muted-foreground">unit · {formatNumber(player.games, 0)} games</div>
            </div>
          ) : (
            <PlayerCell
              athleteId={player.athleteId}
              name={player.name}
              team={player.team}
              position={`${formatNumber(player.games, 0)} games`}
              logo={logo}
            />
          )}
        </div>
        <div className="flex shrink-0 gap-4 text-right">
          <div className="flex flex-col items-end">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              grade <InfoTip text={GRADE_TIP} label="What is the grade?" />
            </span>
            <span className="font-mono text-xl font-bold tabular-nums leading-tight">{formatNumber(player.grade, 1)}</span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              ±{formatNumber(player.uncertainty, 1)} · pct {player.gradePercentile == null ? EMPTY : Math.round(player.gradePercentile)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              WAR <InfoTip text={WAR_TIP} label="What is wins above replacement?" />
            </span>
            <span
              className={cn(
                "font-mono text-xl font-bold tabular-nums leading-tight",
                player.war != null && player.war > 0 && "text-positive"
              )}
            >
              {player.war == null ? EMPTY : formatSigned(player.war, 2)}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {player.pointsAboveReplacement == null ? "no credited plays" : `${formatSigned(player.pointsAboveReplacement, 0)} pts`}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        {player.traits.map((trait) => (
          <TraitRow key={trait.trait} trait={trait} />
        ))}
      </div>
    </article>
  );
}

export default function PositionGrades({
  groups,
  gradedCounts,
  teams,
}: {
  groups: Record<string, CfbGradedPlayer[]>;
  gradedCounts: Record<string, number>;
  teams: CfbTeamIdentity[];
}) {
  const available = POSITIONS.filter((p) => (groups[p.key]?.length ?? 0) > 0);
  const [position, setPosition] = useState<PositionGroup>(available[0]?.key ?? "QB");
  const logoFor = useMemo(() => {
    const byName = new Map(teams.map((t) => [t.team, t] as const));
    return (team: string) => byName.get(team);
  }, [teams]);
  const players = groups[position] ?? [];
  const graded = gradedCounts[position] ?? 0;

  return (
    <div className="space-y-section">
      <ToggleGroup label="Position" options={available} value={position} onChange={setPosition} />
      <p className="max-w-4xl text-sm text-muted-foreground leading-relaxed">
        Top {players.length} of {graded} graded {position}. Every bar is a percentile among
        qualified FBS players at the position this week: gold bars are counted from the
        player&apos;s own tagged plays or box score, striped blue bars are inferred from unit
        outcomes or teammates, and dimmed traits carry no weight in the grade.
      </p>
      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
        {players.map((player, index) => (
          <GradeCard key={player.athleteId} rank={index + 1} player={player} logo={logoFor(player.team)} />
        ))}
      </div>
    </div>
  );
}
