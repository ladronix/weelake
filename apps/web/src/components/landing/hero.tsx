import type { ReactNode } from "react";

export function Hero({ children }: { children?: ReactNode }) {
  return (
    <section className="section pt-8 sm:pt-14 pb-4 relative">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/60 backdrop-blur-md border border-white/70 px-3 py-1 text-xs sm:text-sm font-medium text-water-700 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-water-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-water-500" />
          </span>
          Live — updated hourly · Free forever
        </div>
        <h1 className="mt-5 text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.02]">
          <span className="text-water-gradient">Every lake.</span>
          <br />
          <span className="text-deep">One map. Live.</span>
        </h1>
        <p className="mt-5 text-slate-600 max-w-2xl mx-auto text-base sm:text-lg">
          Live water temperatures for lakes worldwide. Search a name, tap your location,
          and find the perfect swim near you. Data from Copernicus and Open-Meteo.
        </p>
      </div>

      <div className="mt-7 sm:mt-9 max-w-2xl mx-auto">
        {children}
      </div>
    </section>
  );
}
