"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { translate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

export function Footer() {
  const t = useT();
  const { mounted } = usePrefs();
  const label = mounted ? t : (key: string, vars?: Record<string, string | number>) => translate(DEFAULT_LOCALE, key, vars);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 border-t border-water-100/70 bg-white/40 backdrop-blur-md safe-b">
      <div className="section py-10 grid gap-8 md:grid-cols-4">
        <div>
          <div className="font-semibold text-deep tracking-tight">Weelake</div>
          <p className="mt-2 text-sm text-slate-600">
            {label("footer.tagline")}
          </p>
        </div>
        <FooterColumn heading={label("footer.product")}>
          <FooterLink href="/map">{label("footer.map")}</FooterLink>
          <FooterLink href="/#countries">{label("footer.countries")}</FooterLink>
          <FooterLink href="/api/lakes" external>{label("footer.api")}</FooterLink>
        </FooterColumn>
        <FooterColumn heading={label("footer.data")}>
          <FooterLink href="/sources">{label("footer.sources")}</FooterLink>
          <FooterLink href="https://marine.copernicus.eu" external>Copernicus Marine</FooterLink>
          <FooterLink href="https://open-meteo.com" external>Open-Meteo</FooterLink>
          <FooterLink href="https://www.hydrosheds.org/products/hydrolakes" external>HydroLAKES</FooterLink>
          <FooterLink href="https://www.openstreetmap.org" external>OpenStreetMap</FooterLink>
        </FooterColumn>
        <FooterColumn heading={label("footer.legal")}>
          <FooterLink href="/about">{label("footer.about")}</FooterLink>
          <FooterLink href="/privacy">{label("footer.privacy")}</FooterLink>
          <FooterLink href="/attribution">{label("footer.attribution")}</FooterLink>
        </FooterColumn>
      </div>
      <div className="border-t border-water-100/60 py-4 text-center text-xs text-slate-500">
        {label("footer.copyright", { year })}
      </div>
    </footer>
  );
}

function FooterColumn({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold text-deep">{heading}</div>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    "hover:text-water-700 focus:outline-none focus-visible:underline focus-visible:text-water-700";
  return (
    <li>
      {external ? (
        <a href={href} target="_blank" rel="noreferrer" className={cls}>
          {children}
        </a>
      ) : (
        <Link href={href} className={cls}>
          {children}
        </Link>
      )}
    </li>
  );
}
