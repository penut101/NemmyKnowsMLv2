import { PageDescription, PageHeader, PageSection, PageShell, PageTitle } from "@/components/page-layout";
import { IntentLink as Link } from "@/components/navigation-link";
import { HomeFeatureSlot } from "@/components/home-feature-slot";
import { fetchHomeFeature } from "@/lib/home-features.server";
import { SiteHeader } from "@/components/site-header";
import { ContactLine } from "@/components/site-footer";
import { fetchBettingHeadline } from "@/lib/bet-ledger";
import { mlbHeadline } from "@/lib/mlb-headline";
import { supabase, supabaseCfb, supabaseNfl } from "@/lib/supabase";
import { formatNumber, formatPct, formatSigned } from "@/lib/utils";
import { fetchLivePerformance } from "@/lib/cfb";
import { fetchForecastAccuracy as fetchNflAccuracy } from "@/lib/nfl";
import { fetchCfbPickSummary } from "@/lib/cfb-picks";
import { fetchNflPickSummary } from "@/lib/nfl-picks";
import { fetchNhlPickSummary } from "@/lib/nhl-picks";
import {
  fetchForecastAccuracy as fetchNhlAccuracy,
  fetchLatestRatings as fetchNhlRatings,
  type NhlAccuracySlice,
} from "@/lib/nhl";
import { marketRecords, type MarketRecord } from "@/lib/football-picks";
import { SITE_TIME_ZONE, siteDate } from "@/lib/daily-picks";
import { fetchDailyPicks } from "@/lib/daily-picks-fetch";
import { DailyPicks } from "@/components/daily-picks";
import { posts } from "./blog/posts";
import { JsonLd } from "@/components/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_LINKS, SPORT_HOME } from "@/lib/site";

export const revalidate = 3600;

async function getMlbHeadline(): Promise<MarketRecord[] | null> {
  try {
    return mlbHeadline(await fetchBettingHeadline());
  } catch {
    // Home should never 500 because Supabase is unreachable; the MLB card
    // degrades to a plain link.
    return null;
  }
}

// Forecast error is scored on every graded game, so it leads each card; the
// per-market record covers only the games that drew a pick.
type Forecast = {
  stats: { label: string; value: string }[];
  sample: string;
};

function marginForecast(
  modelMae: number | null,
  marketMae: number | null,
  gap: number | null,
  games: number,
): Forecast {
  return {
    stats: [
      { label: "Margin MAE", value: formatNumber(modelMae, 2) },
      { label: "Market MAE", value: formatNumber(marketMae, 2) },
      { label: "Gap to market", value: formatSigned(gap, 2) },
    ],
    sample: `${games} games graded`,
  };
}

// The closing moneyline is the bar once enough live games carry one (30, the
// site's thin-sample line); until then a coin flip is. Model and market are
// scored on the same games.
function nhlForecast(graded: NhlAccuracySlice): Forecast {
  const model = graded.model_log_loss_on_market_games;
  const market = graded.market_log_loss;
  if (model == null || market == null || graded.market_n < 30)
    return {
      stats: [
        { label: "Log loss", value: formatNumber(graded.log_loss, 3) },
        { label: "Coin flip", value: "0.693" },
        { label: "Total MAE", value: formatNumber(graded.total_mae, 2) },
      ],
      sample: `${graded.n} games graded`,
    };
  return {
    stats: [
      { label: "Log loss", value: formatNumber(model, 3) },
      { label: "Market log loss", value: formatNumber(market, 3) },
      { label: "Gap to market", value: formatSigned(model - market, 3) },
    ],
    sample: `${graded.market_n} games with a close`,
  };
}

async function getMlbForecast(): Promise<Forecast | null> {
  const { data } = await supabase
    .from("model_evaluation")
    .select("brier_score, mae, total_predictions")
    .eq("eval_window", "season")
    .not("brier_score", "is", null)
    .order("date", { ascending: false })
    .limit(1);
  const latest = data?.[0];
  if (!latest) return null;
  return {
    stats: [
      { label: "Brier", value: formatNumber(latest.brier_score, 3) },
      { label: "Coin flip", value: "0.250" },
      { label: "Runs MAE", value: formatNumber(latest.mae, 2) },
    ],
    sample: `${latest.total_predictions ?? 0} games graded`,
  };
}

type FootballHeadline = {
  season: number | null;
  week: number | null;
  // Preseason ratings carry a preseason model version; once a weekly refit
  // has published, the card reads as live.
  live: boolean;
  markets: MarketRecord[];
  forecast: Forecast | null;
  // A daily model labels its period itself instead of a week number.
  period?: string;
};

const SEASON_TO_DATE = { market: "all", period: "all", from: null } as const;

async function getCfbHeadline(): Promise<FootballHeadline | null> {
  try {
    const latestRes = await supabaseCfb
      .from("team_ratings")
      .select("season, week, model_version")
      .order("season", { ascending: false })
      .order("week", { ascending: false })
      .limit(1);
    const latest = latestRes.data?.[0];
    if (!latest) return null;
    const [summary, performance] = await Promise.all([
      fetchCfbPickSummary({ ...SEASON_TO_DATE, season: latest.season }),
      fetchLivePerformance(),
    ]);
    const overall = new Map(
      performance.season === latest.season
        ? performance.metrics
            .filter((m) => m.segment_kind === "overall")
            .map((m) => [m.prediction_source, m])
        : [],
    );
    // Grade the published market-informed forecast, as the performance page does.
    const published = overall.get("market_informed") ?? overall.get("pure_model");
    return {
      season: latest.season,
      week: latest.week,
      live: !String(latest.model_version ?? "").startsWith("preseason"),
      markets: marketRecords(summary.metrics),
      forecast: published?.games
        ? marginForecast(
            published.margin_mae,
            overall.get("closing_market")?.margin_mae ?? null,
            published.model_minus_market_mae,
            published.games,
          )
        : null,
    };
  } catch {
    // Home should never 500 because Supabase is unreachable; the CFB card
    // degrades to a plain link.
    return null;
  }
}

async function getNflHeadline(): Promise<FootballHeadline | null> {
  try {
    const latestRes = await supabaseNfl
      .from("game_projections")
      .select("season, week")
      .order("season", { ascending: false })
      .order("week", { ascending: false })
      .limit(1);
    const latest = latestRes.data?.[0];
    if (!latest) return null;
    const [summary, accuracy] = await Promise.all([
      fetchNflPickSummary({ ...SEASON_TO_DATE, season: latest.season }),
      fetchNflAccuracy("live").catch(() => null),
    ]);
    const graded = accuracy?.bySeason.find(
      (slice) => slice.label === String(latest.season),
    );
    return {
      season: latest.season,
      week: latest.week,
      live: true,
      markets: marketRecords(summary.metrics),
      forecast: graded
        ? marginForecast(
            graded.modelMae,
            graded.marketMae,
            graded.modelMae - graded.marketMae,
            graded.games,
          )
        : null,
    };
  } catch {
    // Home should never 500 because Supabase is unreachable; the NFL card
    // degrades to a plain link.
    return null;
  }
}

// The NHL model is daily: the card reads preseason until the first slate's
// decisions are published, and labels the season from the ratings date.
async function getNhlHeadline(): Promise<FootballHeadline | null> {
  try {
    const { asOf } = await fetchNhlRatings();
    if (!asOf) return null;
    const year = Number(asOf.slice(0, 4));
    const month = Number(asOf.slice(5, 7));
    const season = month >= 9 ? year : year - 1;
    const [summary, accuracy] = await Promise.all([
      fetchNhlPickSummary({ ...SEASON_TO_DATE, season }),
      fetchNhlAccuracy("live").catch(() => null),
    ]);
    const graded = accuracy?.by_season.find((slice) => slice.season === season);
    const overall = summary.metrics.find((m) => m.segment_kind === "overall");
    return {
      season,
      week: null,
      live: (overall?.picks ?? 0) + (overall?.no_plays ?? 0) > 0,
      markets: marketRecords(summary.metrics).filter((m) => m.market !== "spreads"),
      forecast: graded ? nhlForecast(graded) : null,
      period: `${season}-${String(season + 1).slice(2)} season`,
    };
  } catch {
    // Home should never 500 because Supabase is unreachable; the NHL card
    // degrades to a plain link.
    return null;
  }
}

// A failed headline fetch is unknown, not preseason: the badge stays off
// rather than claiming a status the render could not read.
function StatusBadge({ live }: { live: boolean | null }) {
  if (live == null) return null;
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-primary" : "bg-muted-foreground"}`}
      />
      {live ? "Live" : "Preseason"}
    </span>
  );
}

type ModelLink = { href: string; label: string };

// The header row is the card's link and its ::after box stretches over the
// whole card, so the card stays clickable without nesting anchors; the
// secondary links sit above that box. Hover styling keys off the header link
// so hovering a secondary link does not light up the card.
function ModelEntry({
  href,
  name,
  live,
  cta,
  description,
  links = [],
  children,
}: {
  href: string;
  name: string;
  live: boolean | null;
  cta: string;
  description: string;
  links?: ModelLink[];
  children?: React.ReactNode;
}) {
  return (
    <div className="relative -mx-3 px-3 py-5 transition-colors has-[>a:hover]:bg-muted/50">
      <Link
        href={href}
        className="group/link flex items-center justify-between gap-4 after:absolute after:inset-0"
      >
        <span className="flex items-baseline gap-3">
          <span className="font-heading text-xl font-semibold tracking-tight text-primary underline-offset-4 group-hover/link:underline">
            {name}
          </span>
          <StatusBadge live={live} />
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground transition-colors group-hover/link:text-primary">
          {cta} &rarr;
        </span>
      </Link>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {children}
      {links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative z-10 font-mono text-xs font-bold uppercase tracking-wider text-foreground underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Record and ROI per market, never pooled: a spread edge and a total edge are
// different claims, so each is judged on its own sample. Plural headings so
// "Totals" cannot read as a total across markets.
const MARKET_HEADINGS = {
  h2h: "Moneylines",
  spreads: "Spreads",
  totals: "Totals",
} as const;

function ModelStats({ forecast, markets, period, spreadLabel = "Spreads" }: {
  forecast: Forecast | null;
  markets: MarketRecord[];
  period: string;
  spreadLabel?: string;
}) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      {forecast && (
        <div>
          <dl className="grid grid-cols-3 gap-x-3">
            {forecast.stats.map((stat) => (
              <div key={stat.label} className="flex min-w-0 flex-col">
                <dt className="flex-1 text-xs text-muted-foreground">{stat.label}</dt>
                <dd className="mt-1 font-mono text-base font-bold text-foreground tabular-nums">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {forecast.sample}
          </p>
        </div>
      )}
      <p className="mt-1 font-mono text-xs text-muted-foreground">{period}</p>
      {markets.length > 0 && (
        <details className="relative z-10 mt-3 text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-offset-4">
            Prediction results
          </summary>
          <table className="mt-2 w-full text-xs tabular-nums">
            <caption className="sr-only">Prediction results by market</caption>
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th scope="col" className="pb-2 text-left font-normal">Market</th>
                <th scope="col" className="px-3 pb-2 text-right font-normal">
                  <abbr title="Wins, losses, pushes" className="no-underline">W-L-P</abbr>
                </th>
                <th scope="col" className="pb-2 text-right font-normal">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {markets.map((record) => (
                <tr key={record.market}>
                  <th scope="row" className="py-2 text-left align-top font-normal text-muted-foreground">
                    {record.market === "spreads" ? spreadLabel : MARKET_HEADINGS[record.market]}
                    {record.pending > 0 && (
                      <span className="mt-0.5 block font-mono">{record.pending} pending</span>
                    )}
                  </th>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-top font-mono text-muted-foreground">
                    {record.wins}&ndash;{record.losses}&ndash;{record.pushes}
                  </td>
                  <td className="whitespace-nowrap py-2 text-right align-top font-mono text-muted-foreground">
                    {formatPct(record.roi)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function FootballStats({ headline }: { headline: FootballHeadline }) {
  const period = headline.period ?? (headline.live
    ? `${headline.season} week ${headline.week ?? "–"}`
    : `${headline.season} preseason`);
  return (
    <ModelStats
      forecast={headline.forecast}
      markets={headline.markets}
      period={period}
    />
  );
}

export default async function Home() {
  const today = siteDate();
  const [mlb, mlbForecast, cfb, nfl, nhl, daily, feature] = await Promise.all([
    getMlbHeadline(),
    getMlbForecast(),
    getCfbHeadline(),
    getNflHeadline(),
    getNhlHeadline(),
    fetchDailyPicks(today),
    fetchHomeFeature(),
  ]);
  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString(
    "en-US",
    { timeZone: SITE_TIME_ZONE, weekday: "long", month: "short", day: "numeric" },
  );
  const latestPosts = posts.slice(0, 2);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              name: SITE_NAME,
              url: SITE_URL,
              description: SITE_DESCRIPTION,
            },
            {
              "@type": "Person",
              name: SITE_NAME,
              url: SITE_URL,
              jobTitle: "Data Analyst",
              sameAs: SOCIAL_LINKS.map((link) => link.href),
            },
          ],
        }}
      />
      <SiteHeader />
      <PageShell width="wide" className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PageHeader className="lg:col-span-2">
          <div>
            <PageTitle>
              Ren&eacute; N&uacute;&ntilde;ez
            </PageTitle>
            <PageDescription>
              Data Analyst. I build probabilistic forecasting
              models for sports and benchmark them against the market in public.
            </PageDescription>
            <ContactLine className="mt-heading text-xs text-muted-foreground" />
          </div>
        </PageHeader>

        <div className="flex min-w-0 flex-col gap-section">
          <PageSection>
            <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Models
            </h2>
            {/* Entries are separated by rules, not enclosed in boxes. */}
            <div className="divide-y divide-border border-y border-rule-strong">
              <ModelEntry
                href={SPORT_HOME.mlb}
                name="MLB"
                live
                cta="Explore players"
                description="Hierarchical Bayesian model simulating every game one plate appearance at a time."
              >
                {mlb && (
                  <ModelStats
                    forecast={mlbForecast}
                    markets={mlb}
                    period="Updated nightly"
                    spreadLabel="Run lines"
                  />
                )}
              </ModelEntry>

              <ModelEntry
                href={SPORT_HOME.cfb}
                name="CFB"
                live={cfb?.live ?? null}
                cta="Explore ratings"
                description="Weekly spread, total, and moneyline predictions with frozen lines, built on power ratings for every Division 1 program."
                links={[{ href: "/cfb/heisman", label: "Heisman tracker" }]}
              >
                {cfb && <FootballStats headline={cfb} />}
              </ModelEntry>

              <ModelEntry
                href={SPORT_HOME.nfl}
                name="NFL"
                live={nfl?.live ?? null}
                cta="Explore ratings"
                description="Bayesian power ratings for all 32 teams from drive-level EPA, with weekly spread and total projections priced against the market."
                links={[
                  { href: "/nfl/season-wins", label: "Season win projections" },
                  { href: "/nfl/awards", label: "Awards tracker" },
                ]}
              >
                {nfl && <FootballStats headline={nfl} />}
              </ModelEntry>

              <ModelEntry
                href={SPORT_HOME.nhl}
                name="NHL"
                live={nhl?.live ?? null}
                cta="Explore ratings"
                description="Poisson goal model from last-25-game shot-quality windows, priced daily against the NHL partner sportsbooks with frozen moneyline and total picks."
              >
                {nhl && <FootballStats headline={nhl} />}
              </ModelEntry>
            </div>
          </PageSection>

          <DailyPicks sports={daily} dateLabel={dateLabel} />

          <PageSection>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Latest writing
              </h2>
              <Link
                href="/blog"
                className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                All posts &rarr;
              </Link>
            </div>
            {latestPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing published yet.
              </p>
            ) : (
              <div className="divide-y divide-border border-y border-rule-strong">
                {latestPosts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group -mx-3 block px-3 py-5 transition-colors hover:bg-muted/50"
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {post.date}
                    </p>
                    <h3 className="font-heading text-base mt-1 group-hover:underline underline-offset-4">
                      {post.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {post.summary}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </PageSection>
        </div>

        <HomeFeatureSlot feature={feature} />
      </PageShell>
    </>
  );
}
