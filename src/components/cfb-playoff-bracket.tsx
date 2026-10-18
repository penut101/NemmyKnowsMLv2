"use client";
import { TeamLogo, type TeamLogoSource } from "@/components/team-logo";
import {
  playoffPercent,
  type CfbPlayoffSlot,
  type CfbPlayoffTeam,
} from "@/lib/cfb-playoffs";

export type PlayoffIdentities = Record<number, TeamLogoSource>;
interface Props {
  bracket: CfbPlayoffSlot[];
  teams: Map<number, CfbPlayoffTeam>;
  identities: PlayoffIdentities;
  onTeam: (id: number) => void;
}
const PATHS = [
  [8, 9, 1],
  [5, 12, 4],
  [7, 10, 2],
  [6, 11, 3],
] as const;
export function CfbPlayoffBracket({
  bracket,
  teams,
  identities,
  onTeam,
}: Props) {
  const slots = new Map(bracket.map((s) => [s.seed, s]));
  function line(seed: number, bye = false) {
    const slot = slots.get(seed)!;
    const team = teams.get(slot.team_id)!;
    return (
      <button
        type="button"
        key={seed}
        onClick={() => onTeam(team.id)}
        aria-label={`${team.team}, seed ${seed}, ${playoffPercent(team.playoff)} playoff chance`}
        className="grid min-h-12 w-full grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-1 px-2 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:grid-cols-[18px_minmax(0,1fr)_auto] sm:gap-2 sm:px-3"
      >
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {seed}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="hidden sm:inline-flex">
            <TeamLogo team={identities[team.id]} name={team.team} />
          </span>
          <span className="min-w-0 text-[11px] font-semibold leading-tight sm:text-sm">
            {team.team}
            {bye && (
              <span className="mt-0.5 block text-[8px] font-normal uppercase tracking-wider text-muted-foreground">
                First-round bye
              </span>
            )}
          </span>
        </span>
        <span className="text-[10px] font-semibold tabular-nums text-primary sm:text-xs">
          {playoffPercent(team.playoff)}
        </span>
      </button>
    );
  }
  return (
    <section aria-label="Projected playoff bracket" className="space-y-4">
      <div>
        <h2 className="font-heading text-xl sm:text-2xl">
          The projected bracket
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          One possible field. Percentages show each team&apos;s overall chance
          to make the playoff.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.15fr_1.15fr_.85fr_.8fr] lg:gap-6">
        <div>
          <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            First round
          </h3>
          <div className="space-y-4">
            {PATHS.map(([h, a]) => (
              <div
                key={h}
                className="relative divide-y divide-border rounded-lg border border-border bg-card after:absolute after:left-full after:top-1/2 after:w-3 after:border-t after:border-border lg:after:w-6"
              >
                {line(h)}
                {line(a)}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quarterfinals
          </h3>
          <div className="space-y-4">
            {PATHS.map(([h, a, b]) => (
              <div key={b} className="rounded-lg border border-border bg-card">
                {line(b, true)}
                <div className="flex min-h-12 items-center border-t border-border px-3 text-[10px] text-muted-foreground sm:text-xs">
                  Winner of {h} vs. {a}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:block">
          <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Semifinals
          </h3>
          <div className="flex h-[440px] flex-col justify-around">
            {[
              [1, 8, 9, 4, 5, 12],
              [2, 7, 10, 3, 6, 11],
            ].map((p) => (
              <div
                key={p[0]}
                className="divide-y divide-border rounded-lg border border-border bg-card text-xs text-muted-foreground"
              >
                <p className="p-4">{p.slice(0, 3).join(" / ")} path</p>
                <p className="p-4">{p.slice(3).join(" / ")} path</p>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:block">
          <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Championship
          </h3>
          <div className="flex h-[440px] items-center">
            <div className="w-full rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
              <p className="font-heading text-lg text-primary">
                National title
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Semifinal winners
              </p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground lg:hidden">
        Semifinals: the 1 and 4 paths meet; the 2 and 3 paths meet. Winners
        advance to the national championship.
      </p>
    </section>
  );
}
