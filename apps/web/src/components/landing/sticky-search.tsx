"use client";

import { useEffect, useState } from "react";
import { LakeSearch } from "@/components/landing/lake-search";
import { useT } from "@/lib/i18n";

/**
 * Sticky compact search bar that appears when the user scrolls past the hero.
 * Fixed just below the nav so it never gets covered.
 */
export function StickySearch() {
  const [visible, setVisible] = useState(false);
  const t = useT();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed top-[76px] sm:top-[88px] inset-x-0 z-20 transition-all duration-300 pointer-events-none ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"
      }`}
      aria-hidden={!visible}
    >
      <div className="section pointer-events-auto">
        <div className="max-w-2xl mx-auto">
          <LakeSearch compact placeholder={t("search.placeholderShort")} />
        </div>
      </div>
    </div>
  );
}

