import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-8 border-t border-water-100/70 bg-white/40 backdrop-blur-md safe-b">
      <div className="section py-10 grid gap-8 md:grid-cols-4">
        <div>
          <div className="font-semibold text-deep tracking-tight">V·Lake</div>
          <p className="mt-2 text-sm text-slate-600">
            Global lake temperatures — live, beautiful, free.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold text-deep">Product</div>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li><Link href="/map" className="hover:text-water-700">Map</Link></li>
            <li><Link href="/#countries" className="hover:text-water-700">Countries</Link></li>
            <li><a href="/api/lakes" className="hover:text-water-700">Public API</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-deep">Data sources</div>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li><a href="https://marine.copernicus.eu" target="_blank" rel="noreferrer" className="hover:text-water-700">Copernicus Marine</a></li>
            <li><a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="hover:text-water-700">Open-Meteo</a></li>
            <li><a href="https://www.hydrosheds.org/products/hydrolakes" target="_blank" rel="noreferrer" className="hover:text-water-700">HydroLAKES</a></li>
            <li><a href="https://www.openstreetmap.org" target="_blank" rel="noreferrer" className="hover:text-water-700">OpenStreetMap</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-deep">Legal</div>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li><Link href="/about" className="hover:text-water-700">About</Link></li>
            <li><Link href="/privacy" className="hover:text-water-700">Privacy</Link></li>
            <li><Link href="/attribution" className="hover:text-water-700">Attribution</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-water-100/60 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} V-Lake. All data attributed to their respective sources.
      </div>
    </footer>
  );
}
