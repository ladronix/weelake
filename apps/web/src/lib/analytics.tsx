"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Weelake · analytics
 *
 * Umami-based, cookie-free, GDPR-friendly.
 * Loaded only in production and only if NEXT_PUBLIC_UMAMI_WEBSITE_ID is set.
 * Falls back gracefully to a noop when disabled.
 */

const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
const SCRIPT_URL = process.env.NEXT_PUBLIC_UMAMI_URL ?? "https://cloud.umami.is/script.js";

// Global namespace typing (light — Umami exposes window.umami).
declare global {
  interface Window {
    umami?: {
      track: (name?: string | ((props: unknown) => unknown), data?: Record<string, unknown>) => void;
    };
  }
}

/** Fire a custom event. Safe to call anywhere — noops when disabled. */
export function track(name: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!window.umami) return;
  try {
    window.umami.track(name, data);
  } catch { /* ignore */ }
}

/** Mount once in the root layout. */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!WEBSITE_ID) return;
    // Umami auto-tracks pageviews from route changes if you use the script tag,
    // but Next.js client-side navigation is missed — we fire an explicit event.
    if (typeof window !== "undefined" && window.umami) {
      try { window.umami.track(); } catch { /* ignore */ }
    }
  }, [pathname]);

  if (!WEBSITE_ID) return null;

  return (
    <script
      async
      defer
      src={SCRIPT_URL}
      data-website-id={WEBSITE_ID}
      data-domains="weelake.com,www.weelake.com"
    />
  );
}
