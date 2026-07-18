import { MapView } from "@/components/map/map-view";
import { Nav } from "@/components/layout/nav";

export const metadata = {
  title: "Live map",
  description: "Live water temperature map for lakes worldwide.",
};

export default function MapPage() {
  return (
    <div className="fixed inset-0 flex flex-col">
      <Nav />
      <main className="flex-1 relative overflow-hidden">
        <MapView />
      </main>
    </div>
  );
}
