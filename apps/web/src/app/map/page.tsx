import { Suspense } from "react";
import { MapView } from "@/components/map/map-view";
import { Nav } from "@/components/layout/nav";

export const metadata = {
  title: "Live map",
  description: "Live water temperature map for lakes worldwide.",
};

export default function MapPage() {
  return (
    <div className="fixed inset-0 bg-water-50 overflow-hidden">
      {/* Map fills the whole viewport; nav floats on top. */}
      <main className="absolute inset-0 overflow-hidden">
        <Suspense fallback={<div className="h-full w-full bg-water-50" />}>
          <MapView />
        </Suspense>
      </main>
      {/* Nav is sticky/absolute so the map goes behind it fully — no more
          blue drop-shadow gap between nav and map. */}
      <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
        <div className="pointer-events-auto">
          <Nav />
        </div>
      </div>
    </div>
  );
}
