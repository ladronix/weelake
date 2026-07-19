"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplet, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { SettingsMenu } from "./settings-menu";

export function Nav() {
  const pathname = usePathname();
  const isMap = pathname === "/map";
  const t = useT();
  return (
    <header className="sticky top-0 z-40 safe-t">
      <div className={cn("section", isMap ? "mt-2 sm:mt-3" : "mt-3")}>
        <nav
          aria-label="Primary"
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 border border-white/60 rounded-full bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(14,165,233,0.10)]",
          )}
        >
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 px-2 py-1 shrink-0 rounded-full",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2",
            )}
            aria-label="V-Lake home"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-water-400 to-water-700 shadow-md">
              <Droplet className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <span className="font-semibold text-deep tracking-tight text-base">V·Lake</span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {!isMap && (
              <Link
                href="/map"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full bg-water-500 hover:bg-water-600 text-white font-medium py-2 px-4 text-sm shadow-[0_4px_16px_rgba(14,165,233,0.35)] transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2",
                )}
              >
                {t("nav.openMap")}
              </Link>
            )}
            <SettingsMenu />
            <button
              type="button"
              className={cn(
                "h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/70 backdrop-blur border border-white/60 flex items-center justify-center text-water-800 hover:bg-white transition opacity-60 cursor-not-allowed",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2",
              )}
              title={`${t("nav.signIn")} (coming soon)`}
              aria-label={t("nav.signIn")}
              disabled
            >
              <User className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
