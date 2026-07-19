"use client";

import { useT } from "@/lib/i18n";

/**
 * SectionHeading — a client-side i18n wrapper for landing sections.
 * Kept as an island so the surrounding server component (page.tsx)
 * stays a Server Component and can still stream data via Suspense.
 */
export function SectionHeading({
  titleKey,
  subtitleKey,
  hint,
}: {
  titleKey: string;
  subtitleKey?: string;
  /** Optional right-side hint (already localised via t()); pass a t-key or a ReactNode. */
  hint?: string;
}) {
  const t = useT();
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-deep">
          {t(titleKey)}
        </h2>
        {subtitleKey && (
          <p className="mt-1 text-slate-600 max-w-xl">{t(subtitleKey)}</p>
        )}
      </div>
      {hint && (
        <div className="text-xs text-slate-500 hidden sm:block">{t(hint)}</div>
      )}
    </div>
  );
}

/**
 * CTA block on the landing page — big gradient banner.
 * Client-side because the button and copy are user-locale sensitive.
 */
export function CtaBanner() {
  const t = useT();
  return (
    <div className="rounded-4xl overflow-hidden bg-gradient-to-br from-water-500 via-water-600 to-water-800 p-8 sm:p-14 text-center shadow-[0_20px_60px_rgba(14,165,233,0.30)] relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255,255,255,0.20), transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(56, 189, 248, 0.30), transparent 50%)
          `,
        }}
      />
      <h3 className="relative text-2xl sm:text-4xl font-semibold text-white tracking-tight">
        {t("cta.title")}
      </h3>
      <p className="relative mt-3 text-white/90 max-w-xl mx-auto text-base sm:text-lg">
        {t("cta.subtitle")}
      </p>
      <a
        href="/map"
        className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-white text-water-700 font-semibold text-base py-3 px-6 shadow-lg hover:shadow-xl hover:scale-105 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
      >
        {t("cta.openMap")}
      </a>
    </div>
  );
}
