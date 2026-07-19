"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Settings, Thermometer, Globe2, Check, MonitorSmartphone } from "lucide-react";
import { usePrefs, type TempUnit } from "@/lib/prefs";
import { useT } from "@/lib/i18n";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const LANG_META: Record<Locale, { label: string; flag: string; native: string }> = {
  en: { label: "English", flag: "🇬🇧", native: "English" },
  cs: { label: "Čeština", flag: "🇨🇿", native: "Čeština" },
  de: { label: "Deutsch", flag: "🇩🇪", native: "Deutsch" },
};

const UNIT_META: Record<TempUnit, { symbol: string; labelKey: string }> = {
  C: { symbol: "°C", labelKey: "settings.celsius" },
  F: { symbol: "°F", labelKey: "settings.fahrenheit" },
};

/**
 * SettingsMenu
 * ------------
 * Popover with two radio groups (temperature units + language) and a
 * "Use system language" quick action that reverts to the auto-detected
 * locale. Keyboard-accessible, WAI-ARIA compliant, closes on Escape and
 * outside click, restores focus to the trigger on close.
 */
export function SettingsMenu() {
  const { prefs, update, resetLangToSystem, mounted } = usePrefs();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const panelId = useId();

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the trigger for keyboard users.
    triggerRef.current?.focus();
  }, []);

  // Outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Move focus into the panel on open for immediate keyboard nav.
  useEffect(() => {
    if (!open) return;
    // Focus the first interactive control (unit selector).
    const first = panelRef.current?.querySelector<HTMLElement>("[role='radio']");
    first?.focus();
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-white/70 backdrop-blur border border-white/60",
          "flex items-center justify-center text-water-800 hover:bg-white transition",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500 focus-visible:ring-offset-2",
        )}
        aria-label={t("nav.settings")}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={panelId}
        title={t("nav.settings")}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={t("settings.title")}
          className={cn(
            "absolute right-0 top-11 sm:top-12 w-72 rounded-3xl bg-white/95 backdrop-blur-xl",
            "border border-white/60 shadow-[0_10px_40px_rgba(14,165,233,0.20)] p-3 z-50",
          )}
        >
          {/* Units */}
          <SectionHeader icon={<Thermometer className="h-3 w-3" aria-hidden="true" />}>
            {t("settings.units")}
          </SectionHeader>
          <div
            role="radiogroup"
            aria-label={t("settings.units")}
            className="grid grid-cols-2 gap-1.5"
          >
            {(["C", "F"] as TempUnit[]).map((u) => (
              <OptionButton
                key={u}
                role="radio"
                selected={prefs.unit === u}
                onClick={() => update({ unit: u })}
                aria-checked={prefs.unit === u}
              >
                <span className="font-semibold tabular-nums mr-2">{UNIT_META[u].symbol}</span>
                <span>{t(UNIT_META[u].labelKey)}</span>
              </OptionButton>
            ))}
          </div>

          {/* Language */}
          <SectionHeader
            icon={<Globe2 className="h-3 w-3" aria-hidden="true" />}
            className="mt-3"
          >
            {t("settings.language")}
          </SectionHeader>
          <div
            role="radiogroup"
            aria-label={t("settings.language")}
            className="space-y-1"
          >
            {SUPPORTED_LOCALES.map((code) => {
              const meta = LANG_META[code];
              const selected = prefs.lang === code;
              return (
                <OptionButton
                  key={code}
                  role="radio"
                  selected={selected}
                  onClick={() => update({ lang: code })}
                  aria-checked={selected}
                  className="w-full"
                >
                  <span className="text-lg leading-none" aria-hidden="true">
                    {meta.flag}
                  </span>
                  <span className="flex-1 text-left">{meta.native}</span>
                  {selected && <Check className="h-4 w-4" aria-hidden="true" />}
                </OptionButton>
              );
            })}
          </div>

          {/* System-language quick action */}
          {mounted && prefs.langSource === "user" && (
            <button
              type="button"
              onClick={resetLangToSystem}
              className={cn(
                "mt-2 w-full flex items-center gap-2 rounded-2xl px-3 py-2 text-xs",
                "text-water-700 hover:bg-water-50 transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500",
              )}
            >
              <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t("settings.system")}</span>
            </button>
          )}
          {mounted && prefs.langSource === "auto" && (
            <p className="mt-2 px-3 text-[10px] text-slate-500 flex items-center gap-1.5">
              <MonitorSmartphone className="h-3 w-3" aria-hidden="true" />
              {t("settings.systemDetected")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[10px] uppercase tracking-wider text-slate-500 font-semibold",
        "flex items-center gap-1.5 px-1 mb-2",
        className,
      )}
    >
      {icon}
      {children}
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
  className,
  role,
  ...rest
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  role: "radio";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "role">) {
  return (
    <button
      type="button"
      role={role}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-water-500",
        selected
          ? "bg-water-500 text-white shadow"
          : "bg-water-50 text-slate-700 hover:bg-water-100",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
