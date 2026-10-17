import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SiteAnalytics } from "@/components/site-analytics";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, TWITTER_HANDLE } from "@/lib/site";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
});

const metropolis = localFont({
  src: [
    { path: "./fonts/Metropolis-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Metropolis-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Metropolis-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Metropolis-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-metropolis",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "René Núñez | Probabilistic Sports Forecasting",
    template: "%s | René Núñez",
  },
  description: SITE_DESCRIPTION,
  // "./" resolves to the current route, so every page canonicalizes to its own
  // www URL without repeating the field in each segment.
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: "./",
  },
  twitter: {
    card: "summary_large_image",
    creator: TWITTER_HANDLE,
  },
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sourceSans.variable} ${metropolis.variable} h-full overflow-x-hidden antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
          <SiteAnalytics />
          <SpeedInsights />
        </ThemeProvider>
        {process.env.VERCEL_ENV === "production" && (
          <Script
            id="cloudflare-web-analytics"
            type="module"
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon='{"token":"dba42dc69c18403399e0de43de4bd52e"}'
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
