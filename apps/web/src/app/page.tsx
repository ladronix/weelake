import { Suspense } from "react";
import { Hero } from "@/components/landing/hero";
import { LiveStats } from "@/components/landing/live-stats";
import { LakeSearch } from "@/components/landing/lake-search";
import { CountryGrid } from "@/components/landing/country-grid";
import { HotColdLists } from "@/components/landing/hot-cold-lists";
import { MiniMapPreview } from "@/components/landing/mini-map-preview";
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
          className="pointer-events-none absolute inset-0 -z-10 bg-water-mesh opacity-60"
        />
        <Hero>
          <LakeSearch autofocus />
        </Hero>

        <section className="section mt-2 sm:mt-6">
          <Suspense fallback={<StatsSkeleton />}>
            <LiveStats />
          </Suspense>
        </section>

        <section className="section mt-10 sm:mt-16">
          <Suspense fallback={<div className="h-[420px] skeleton rounded-4xl" />}>
            <MiniMapPreview />
          </Suspense>
        </section>

        <section className="section mt-14 sm:mt-24">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-deep">
            Explore by country
          </h2>
          <p className="mt-2 text-slate-600 max-w-xl">
            Freshwater around the world. Pick a country to see live temperatures.
          </p>
          <div className="mt-6">
            <Suspense fallback={<GridSkeleton />}>
              <CountryGrid />
            </Suspense>
          </div>
        </section>

        <section className="section mt-14 sm:mt-24">
          <Suspense fallback={<div className="h-64 skeleton rounded-4xl" />}>
            <HotColdLists />
          </Suspense>
        </section>

        <section className="section mt-14 sm:mt-24 pb-16">
          <div className="glass rounded-4xl px-6 py-8 sm:px-10 sm:py-12 text-center">
            <h3 className="text-2xl sm:text-3xl font-semibold text-deep">
              Ready to dive in?
            </h3>
            <p className="mt-3 text-slate-600 max-w-xl mx-auto">
              Open the full map. Filter by temperature, country, or activity.
              It&apos;s free — forever.
            </p>
            <a href="/map" className="btn-water mt-6 inline-flex">
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
        <div key={i} className="h-24 skeleton rounded-3xl" />
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
