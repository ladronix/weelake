"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplet, Map as MapIcon, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Nav() {
  const pathname = usePathname();
  const isMap = pathname === "/map";
  return (
    <header className="sticky top-0 z-40 safe-t">
      <div className={cn("section", isMap ? "mt-0" : "mt-3")}>
        <nav
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 border border-white/60",
            isMap
              ? "rounded-none bg-white/85 backdrop-blur-xl shadow-[0_4px_16px_rgba(14,165,233,0.10)]"
              : "rounded-full bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(14,165,233,0.10)]",
          )}
        >
          <Link href="/" className="flex items-center gap-2 px-2 py-1">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-water-400 to-water-700 shadow-md">
              <Droplet className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-deep tracking-tight text-base">V·Lake</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/map"
              className={cn(
                "hidden sm:inline-flex items-center gap-2 rounded-full py-2 px-3.5 text-sm font-medium transition",
                pathname === "/map"
                  ? "bg-water-100 text-water-800"
                  : "text-water-800 hover:bg-water-100/60",
              )}
            >
              <MapIcon className="h-4 w-4" /> Map
            </Link>
            <Link
              href="/#countries"
              className="hidden sm:inline-flex items-center gap-2 rounded-full py-2 px-3.5 text-sm font-medium text-water-800 hover:bg-water-100/60 transition"
            >
              <Globe2 className="h-4 w-4" /> Countries
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-full bg-water-500 hover:bg-water-600 text-white font-medium py-2 px-4 text-sm shadow-[0_4px_16px_rgba(14,165,233,0.35)] transition"
            >
              Open map
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
