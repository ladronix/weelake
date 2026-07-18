import Link from "next/link";
import { Droplet, Map as MapIcon, Globe2 } from "lucide-react";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 safe-t">
      <div className="section mt-3">
        <nav className="glass rounded-full flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
          <Link href="/" className="flex items-center gap-2 px-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-water-gradient shadow-md">
              <Droplet className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-deep tracking-tight">
              V·Lake
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/map"
              className="hidden sm:inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-water-800 hover:bg-water-100/60 transition"
            >
              <MapIcon className="h-4 w-4" /> Map
            </Link>
            <Link
              href="/#countries"
              className="hidden sm:inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-water-800 hover:bg-water-100/60 transition"
            >
              <Globe2 className="h-4 w-4" /> Countries
            </Link>
            <Link href="/map" className="btn-water text-sm py-2 px-4">
              Open map
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
