import { MapView } from "@/components/map/map-view";
import { Nav } from "@/components/layout/nav";

export const metadata = {
  title: "Live map",
  description: "Live water temperature map for lakes worldwide.",
};

export default function MapPage() {
  return (
    <>
      <Nav />
      <main className="fixed inset-0 top-[64px] sm:top-[80px]">
        <MapView />
      </main>
    </>
  );
}
