import { Suspense } from "react";
import { Hero } from "@/components/landing/hero";
import { LiveStats } from "@/components/landing/live-stats";
import { LakeSearch } from "@/components/landing/lake-search";
import { NearYou } from "@/components/landing/near-you";
import { CountryGrid } from "@/components/landing/country-grid";
import { HotColdLists } from "@/components/landing/hot-cold-lists";
import { MiniMapPreview } from "@/components/landing/mini-map-preview";
import { StickySearch } from "@/components/landing/sticky-search";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main className="relative overflow-hidden">
        {/* Ambient water background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-water-mesh opacity-70"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 -z-10 h-96 w-96 rounded-full bg-water-300/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-64 -left-24 -z-10 h-72 w-72 rounded-full bg-cyan-300/30 blur-3xl"
        />

        <Hero>
          <LakeSearch autofocus />
        </Hero>

        <StickySearch />

        <section className="section mt-4 sm:mt-8">
          <Suspense fallback={<StatsSkeleton />}>
            <LiveStats />
          </Suspense>
        </section>

        <section className="section mt-8 sm:mt-14">
          <NearYou />
        </section>

        <section className="section mt-10 sm:mt-16">
          <Suspense fallback={<div className="h-[420px] skeleton rounded-4xl" />}>
            <MiniMapPreview />
          </Suspense>
        </section>

        <section className="section mt-14 sm:mt-24" id="countries">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-deep">
                Explore by country
              </h2>
              <p className="mt-1 text-slate-600 max-w-xl">
                Pick a country to see all its tracked lakes and their live temperatures.
              </p>
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">
              Number is average water temperature
            </div>
          </div>
          <div className="mt-6">
            <Suspense fallback={<GridSkeleton />}>
              <CountryGrid />
            </Suspense>
          </div>
        </section>

        <section className="section mt-14 sm:mt-24">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-deep">
            Today&apos;s extremes
          </h2>
          <p className="mt-1 text-slate-600 max-w-xl">
            The hottest and coldest lakes on the planet right now.
          </p>
          <div className="mt-6">
            <Suspense fallback={<div className="h-64 skeleton rounded-4xl" />}>
              <HotColdLists />
            </Suspense>
          </div>
        </section>

        <section className="section mt-14 sm:mt-24 pb-20">
          <div className="rounded-4xl overflow-hidden bg-gradient-to-br from-water-500 via-water-600 to-water-800 p-8 sm:p-14 text-center shadow-[0_20px_60px_rgba(14,165,233,0.30)] relative">
            <div
              aria-hidden
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 20% 30%, rgba(255,255,255,0.20), transparent 50%),
                  radial-gradient(circle at 80% 70%, rgba(56, 189, 248, 0.30), transparent 50%)
                `,
              }}
            />
            <h3 className="relative text-2xl sm:text-4xl font-semibold text-white tracking-tight">
              Ready to dive in?
            </h3>
            <p className="relative mt-3 text-white/90 max-w-xl mx-auto text-base sm:text-lg">
              Open the full map. Filter by country, temperature, or activity. It&apos;s free — forever.
            </p>
            <a
              href="/map"
              className="relative mt-7 inline-flex items-center gap-2 rounded-full bg-white text-water-700 font-semibold text-base py-3 px-6 shadow-lg hover:shadow-xl hover:scale-105 transition"
            >
              Open the map →
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-32 skeleton rounded-3xl" />
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-28 skeleton rounded-3xl" />
      ))}
    </div>
  );
}
