import { PageDescription, PageHeader, PageShell, PageTitle } from "@/components/page-layout";
import type { Metadata } from "next";
import { fetchPlayerValues } from "@/lib/mlb-players";
import { formatNumber } from "@/lib/utils";
import { KpiCard } from "@/components/kpi-card";
import { LastUpdated } from "@/components/last-updated";
import MlbPlayerValues from "@/components/mlb-player-values";
import { GRADE_TIP, TRADE_VALUE_TIP, formatMillions } from "@/lib/player-values";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { season } = await fetchPlayerValues();
  const year = season ?? new Date().getFullYear();
  return {
    title: `MLB Player Values ${year}`,
    description: `A projected 20 to 80 grade, a trade value in dollars over control years, and this season's wins above replacement for every MLB 40-man player, built from skill measurements rather than box score totals.`,
  };
}

export default async function MlbPlayersPage() {
  const values = await fetchPlayerValues();
  const { season, index } = values;

  if (season == null || index.length === 0) {
    return (
      <PageShell>
        <PageTitle>Player Values</PageTitle>
        <p className="text-muted-foreground">No player values have been published yet.</p>
      </PageShell>
    );
  }

  const graded = index.filter((row) => row.grade != null);
  const top = [...graded].sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0))[0] ?? null;
  const bargain = [...graded].filter((row) => row.control_years > 0).sort((a, b) => (b.trade_value_musd ?? -Infinity) - (a.trade_value_musd ?? -Infinity))[0] ?? null;

  return (
    <PageShell>
      <PageHeader>
        <div>
          <PageTitle>Player Values</PageTitle>
          <PageDescription className="font-mono text-xs uppercase tracking-wider">
            Projecting the {season} season
          </PageDescription>
        </div>
        <LastUpdated timestamp={values.asOf} schedule="Updates nightly" />
      </PageHeader>

      <p className="max-w-4xl text-sm text-muted-foreground leading-relaxed">
        Three numbers per player. The Grade is a 20 to 80 projection of true talent for a full season at his
        position, built from skill measurements (swing decisions, contact quality, bat speed, pitch
        characteristics, range, speed) and a shrunk outcome record, with weights fitted to predict a
        player&apos;s own next season. Trade value prices that projection over his remaining control years at
        the market rate for a win and subtracts what he is owed. Impact is what he actually produced this
        season. Every number opens to show what went into it.
      </p>

      <div className="grid grid-cols-2 gap-4 border-y border-rule-strong py-4 sm:grid-cols-3">
        <KpiCard
          label="Top graded"
          value={top?.player_name ?? "–"}
          sub={top ? `${top.team || "FA"} · ${top.position_group} · ${formatNumber(top.grade, 0)} grade` : "no graded players"}
          tooltip={GRADE_TIP}
        />
        <KpiCard
          label="Best trade value"
          value={bargain?.player_name ?? "–"}
          sub={bargain ? `${bargain.team || "FA"} · ${bargain.position_group} · ${formatMillions(bargain.trade_value_musd)} over ${bargain.control_years} yrs` : "no contracts"}
          tooltip={TRADE_VALUE_TIP}
        />
        <KpiCard
          label="Graded players"
          value={formatNumber(graded.length, 0)}
          sub={`of ${index.length} on 40-man rosters`}
          tooltip="Requires a season-equivalent sample of 100 plate appearances or batters faced across the last three seasons."
        />
      </div>

      <MlbPlayerValues index={index} />
    </PageShell>
  );
}
