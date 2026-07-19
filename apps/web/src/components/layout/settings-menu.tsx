"use client";

import { useEffect, useRef, useState } from "react";
import { Settings, Thermometer, Globe2, Check } from "lucide-react";
import { usePrefs, type TempUnit, type Language } from "@/lib/prefs";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LANGS: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English",  flag: "🇬🇧" },
  { code: "cs", label: "Čeština",  flag: "🇨🇿" },
  { code: "de", label: "Deutsch",  flag: "🇩🇪" },
];

export function SettingsMenu() {
  const { prefs, update } = usePrefs();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/70 backdrop-blur border border-white/60 flex items-center justify-center text-water-800 hover:bg-white transition"
        aria-label={t("nav.settings")}
        aria-expanded={open}
        title={t("nav.settings")}
      >
        <Settings className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 sm:top-12 w-64 rounded-3xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-[0_10px_40px_rgba(14,165,233,0.20)] p-3 z-50">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1.5 px-1 mb-2">
            <Thermometer className="h-3 w-3" /> {t("settings.units")}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["C", "F"] as TempUnit[]).map((u) => (
              <button
                key={u}
                onClick={() => update({ unit: u })}
                className={cn(
                  "rounded-2xl px-3 py-2 text-sm font-medium transition text-left",
                  prefs.unit === u
                    ? "bg-water-500 text-white shadow"
                    : "bg-water-50 text-slate-700 hover:bg-water-100",
                )}
              >
                {u === "C" ? "°C  Celsius" : "°F  Fahrenheit"}
              </button>
            ))}
          </div>

          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1.5 px-1 mt-3 mb-2">
            <Globe2 className="h-3 w-3" /> {t("settings.language")}
          </div>
          <div className="space-y-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => update({ lang: l.code })}
                className={cn(
                  "w-full flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition",
                  prefs.lang === l.code
                    ? "bg-water-500 text-white shadow"
                    : "bg-water-50 text-slate-700 hover:bg-water-100",
                )}
              >
                <span className="text-lg leading-none">{l.flag}</span>
                <span className="flex-1 text-left">{l.label}</span>
                {prefs.lang === l.code && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
