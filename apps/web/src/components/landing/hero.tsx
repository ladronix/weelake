import type { ReactNode } from "react";

export function Hero({ children }: { children?: ReactNode }) {
  return (
    <section className="section pt-10 sm:pt-16 pb-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs sm:text-sm font-medium text-water-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-water-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-water-500" />
          </span>
          Live · updated hourly
        </div>
        <h1 className="mt-4 text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05]">
          <span className="text-water-gradient">Global lake temperatures.</span>
          <br />
          <span className="text-deep">Live. Beautiful. Free.</span>
        </h1>
        <p className="mt-5 text-slate-600 max-w-2xl mx-auto text-base sm:text-lg">
          One map for every lake on Earth. Search by name, filter by temperature,
          find the perfect swim near you. Data from Copernicus and Open-Meteo — always free.
        </p>
      </div>

      <div className="mt-8 sm:mt-10 max-w-2xl mx-auto">
        {children}
      </div>
    </section>
  );
}
