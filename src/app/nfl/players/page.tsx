import { PageDescription, PageHeader, PageShell, PageTitle } from "@/components/page-layout";
import { NFL_PLAYER_SECTIONS, PlayerSectionTabs } from "@/components/player-section-tabs";
import type { Metadata } from "next";
import { fetchNflPositionGrades, fetchTeams } from "@/lib/nfl";
import { formatNumber, formatSigned } from "@/lib/utils";
import { KpiCard } from "@/components/kpi-card";
import { LastUpdated } from "@/components/last-updated";
import PositionGrades, { type GradeTeam } from "@/components/position-grades";
import { SPORT_COPY } from "@/lib/position-traits";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { season, week } = await fetchNflPositionGrades();
  const year = season ?? new Date().getFullYear();
  return {
    title: `NFL Player Grades ${year}`,
    description: `Per-position scouting grades and wins above replacement for every qualified NFL player in ${year}${week != null ? ` through week ${week}` : ""}, built from opponent-adjusted traits rather than raw box score totals.`,
  };
}

export default async function NflPlayersPage() {
  const [grades, teams] = await Promise.all([fetchNflPositionGrades(), fetchTeams()]);
  const { season, week, index, details, gradedCounts } = grades;
  const copy = SPORT_COPY.nfl;

  if (season == null || index.length === 0) {
    return (
      <PageShell>
        <PageTitle>Player Grades</PageTitle>
        <PlayerSectionTabs sections={NFL_PLAYER_SECTIONS} />
        <p className="text-muted-foreground">
          No position grades have been published yet. The grades appear once the
          first week of the season is final.
        </p>
      </PageShell>
    );
  }

  const topQb = index.find((row) => row.positionGroup === "QB" && row.grade != null) ?? null;
  const warLeader = Object.values(details)
    .filter((p) => p.war != null)
    .sort((a, b) => (b.war ?? 0) - (a.war ?? 0))[0] ?? null;
  const gradedTotal = Object.values(gradedCounts).reduce((sum, n) => sum + n, 0);
  const logos: GradeTeam[] = [...teams.values()].map((t) => ({
    team: t.team_abbr,
    logo_light: t.logo_light,
    logo_dark: t.logo_dark,
  }));

  return (
    <PageShell>
      <PageHeader>
        <div>
          <PageTitle>Player Grades</PageTitle>
          <PageDescription className="font-mono text-xs uppercase tracking-wider">
            {season} · Through week {week}
          </PageDescription>
        </div>
        <LastUpdated timestamp={grades.asOf} schedule="Updates after each Tuesday refresh" />
      </PageHeader>
      <PlayerSectionTabs sections={NFL_PLAYER_SECTIONS} />

      <p className="max-w-4xl text-sm text-muted-foreground leading-relaxed">
        A 20 to 80 grade and wins above replacement for every qualified player. Quarterback
        and running back grades are fitted forecasts of the rest of the season, checked on a
        held-out season against EPA alone; the info icon on every measure says how it is
        calculated and how well it repeats.
      </p>

      <div className="grid grid-cols-2 gap-4 border-y border-rule-strong py-4 sm:grid-cols-3">
        <KpiCard
          label="Top graded QB"
          value={topQb?.name ?? "–"}
          sub={topQb ? `${topQb.team} · ${formatNumber(topQb.grade, 1)} grade` : "no graded quarterbacks"}
          tooltip={copy.gradeTip}
        />
        <KpiCard
          label="WAR leader"
          value={warLeader?.name ?? "–"}
          sub={warLeader ? `${warLeader.team} · ${formatSigned(warLeader.war, 2)} wins` : "no credited plays"}
          tooltip={`${copy.warTip} Leader among the players shown on the server-rendered page.`}
        />
        <KpiCard
          label="Graded players"
          value={formatNumber(gradedTotal, 0)}
          sub="qualified NFL players this week"
          tooltip="A player qualifies once he has played enough games for the week (up to six) and has values for the traits that carry his position's grade."
        />
      </div>

      <PositionGrades
        sport="nfl"
        season={season}
        index={index}
        details={details}
        gradedCounts={gradedCounts}
        teams={logos}
      />
    </PageShell>
  );
}
