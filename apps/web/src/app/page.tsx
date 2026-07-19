import { Suspense } from "react";
import { Hero } from "@/components/landing/hero";
import { HeroBackground } from "@/components/landing/hero-background";
import { LiveStats } from "@/components/landing/live-stats";
import { LakeSearch } from "@/components/landing/lake-search";
import { NearYou } from "@/components/landing/near-you";
import { CountryGrid } from "@/components/landing/country-grid";
import { HotColdLists } from "@/components/landing/hot-cold-lists";
import { MiniMapPreview } from "@/components/landing/mini-map-preview";
import { StickySearch } from "@/components/landing/sticky-search";
import { SectionHeading, CtaBanner } from "@/components/landing/section-heading";
import { Nav } from "@/components/layout/nav";
import { Footer } from "@/components/layout/footer";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main className="relative overflow-hidden">
        <HeroBackground />

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
          <MiniMapPreview />
        </section>

        <section className="section mt-14 sm:mt-24" id="countries">
          <SectionHeading
            titleKey="countries.title"
            subtitleKey="countries.subtitle"
            hint="countries.hint"
          />
          <div className="mt-6">
            <Suspense fallback={<GridSkeleton />}>
              <CountryGrid />
            </Suspense>
          </div>
        </section>

        <section className="section mt-14 sm:mt-24">
          <SectionHeading
            titleKey="extremes.title"
            subtitleKey="extremes.subtitle"
          />
          <div className="mt-6">
            <Suspense fallback={<div className="h-64 skeleton rounded-4xl" />}>
              <HotColdLists />
            </Suspense>
          </div>
        </section>

        <section className="section mt-14 sm:mt-24 pb-20">
          <CtaBanner />
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
