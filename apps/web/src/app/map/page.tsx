import { Suspense } from "react";
import { MapView } from "@/components/map/map-view";
import { Nav } from "@/components/layout/nav";

export const metadata = {
  title: "Live map",
  description: "Live water temperature map for lakes worldwide.",
};

export default function MapPage() {
  return (
    <div className="fixed inset-0 flex flex-col bg-water-50 overflow-hidden">
      <div className="shrink-0">
        <Nav />
      </div>
      <main className="flex-1 relative overflow-hidden min-h-0">
        <Suspense fallback={<div className="h-full w-full bg-water-50" />}>
          <MapView />
        </Suspense>
      </main>
    </div>
  );
}
