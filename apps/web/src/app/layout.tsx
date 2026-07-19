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
  openGraph: {
    type: "website",
    title: `${SITE_NAME} — Global lake temperatures, live`,
    description:
      "One map for every lake on Earth. Live water temperatures, 7-day history, weather, forecasts.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
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
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
