import type { Metadata } from "next";
import Link from "next/link";
import { PageSection, PageShell, PageTitle } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "NemmyKnowsMLv2 sports forecasting, player grades, team ratings, and model methodology.",
};

const models = [
  { name: "MLB", href: "/mlb/methodology", body: "Bayesian hitter and pitcher skills, plate-appearance simulation, player grades, and run distributions." },
  { name: "College football", href: "/cfb/methodology", body: "Possession-level team and unit ratings, player grades, preseason priors, and calibrated game projections." },
  { name: "NFL", href: "/nfl/methodology", body: "Drive-level team strength, quarterback adjustments, player grades, and season and awards projections." },
  { name: "NHL", href: "/nhl/methodology", body: "Shot-quality windows, venue-specific attack and defense strengths, and Poisson goal forecasts." },
];

export default function AboutPage() {
  return (
    <PageShell width="reading">
      <div>
        <PageTitle>About {SITE_NAME}</PageTitle>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Player ratings, team strength, and probabilistic sports forecasts in one place.
          NemmyKnowsMLv2 is maintained by Aiden Nemeroff and builds on René Núñez&apos;s
          Momentum interface and four sport models, used with permission.
        </p>
      </div>
      <PageSection>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Explore the methodology</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {models.map(({ name, href, body }) => (
            <Card key={name} size="sm"><CardContent>
              <Link href={href} className="text-sm font-medium hover:underline underline-offset-4">{name} →</Link>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </CardContent></Card>
          ))}
        </div>
      </PageSection>
      <PageSection>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Forecast evaluation</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Forecasts are evaluated against observed results and market benchmarks.
          Calibration, scoring errors, and historical performance help show the models&apos;
          strengths and limitations. Original research and methodology remain credited
          to their author; this fork&apos;s results depend on its own data and published forecasts.
        </p>
      </PageSection>
      <PageSection>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Credits and contact</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Original interface, models, and research by{" "}
          <a href="https://www.renenunez.dev" className="underline underline-offset-4">René Núñez</a>.
          The original articles are preserved with attribution. For this project, contact{" "}
          <a href="https://github.com/penut101" className="underline underline-offset-4">penut101 on GitHub</a>.
        </p>
      </PageSection>
    </PageShell>
  );
}
