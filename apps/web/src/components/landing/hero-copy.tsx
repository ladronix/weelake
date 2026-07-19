"use client";

import { useT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import { translate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

interface HeroCopyProps {
  /** Optional override, e.g. for A/B testing later. */
  variant?: "default";
}

/**
 * HeroCopy renders the hero live-badge, title and subtitle in the user's
 * preferred language. To avoid hydration mismatch it renders the English
 * copy on the server + first client render, then swaps to the user's
 * locale once `usePrefs.mounted` is true.
 */
export function HeroCopy(_props: HeroCopyProps = {}) {
  const t = useT();
  const { mounted } = usePrefs();

  const label = mounted ? t : (key: string) => translate(DEFAULT_LOCALE, key);

  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur-md border border-white/70 px-3 py-1 text-xs sm:text-sm font-medium text-emerald-700 shadow-sm">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        {label("hero.live")}
      </div>
      <h1 className="mt-5 text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02]">
        <span className="text-water-gradient">{label("hero.title1")}</span>
        <br />
        <span className="text-deep">{label("hero.title2")}</span>
      </h1>
      <p className="mt-5 text-slate-600 max-w-2xl mx-auto text-base sm:text-lg">
        {label("hero.subtitle")}
      </p>
    </div>
  );
}
