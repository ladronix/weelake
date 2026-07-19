"use client";

import { Share2, Check } from "lucide-react";
import { useState } from "react";
import { track } from "@/lib/analytics";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    track("lake.share", { title });
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} · V-Lake`, url });
        return;
      } catch { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/70 backdrop-blur border border-white/60 py-1.5 px-3 text-sm font-medium text-water-700 hover:bg-white transition shadow-sm"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
