import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@/lib/analytics";
import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://weelake.com";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "V-Lake";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Global lake temperatures, live`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Live water temperatures for lakes, reservoirs, and freshwater around the world. Free, beautiful, community-driven. Windy for water.",
  applicationName: SITE_NAME,
  keywords: [
    "lake temperature",
    "water temperature",
    "wild swimming",
    "paddleboard",
    "SUP",
    "wassertemperatur",
    "teplota vody",
    "windy for lakes",
    "swimming forecast",
  ],
  alternates: {
    canonical: SITE_URL,
    // The site is a single locale-agnostic surface (language is
    // switched client-side via preferences); hreflang hints let search
    // engines know which locales the same URL serves.
    languages: {
      "en-US": SITE_URL,
      "cs-CZ": SITE_URL,
      "de-DE": SITE_URL,
      "x-default": SITE_URL,
    },
  },
  openGraph: {
    type: "website",
    title: `${SITE_NAME} — Global lake temperatures, live`,
    description:
      "One map for every lake on Earth. Live water temperatures, 7-day history, weather, forecasts.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    alternateLocale: ["cs_CZ", "de_DE"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Global lake temperatures, live`,
    description: "One map for every lake on Earth. Live, free, beautiful.",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0EA5E9" },
    { media: "(prefers-color-scheme: dark)", color: "#082F49" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Structured data — helps Google build sitelinks/searchbox for the brand.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description:
          "Live water temperatures for lakes worldwide. Free, beautiful, community-driven.",
        inLanguage: ["en", "cs", "de"],
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/map?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/favicon.svg`,
      },
    ],
  };

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
