"use client";

import { TempDisplay } from "@/components/ui";
import { useT } from "@/lib/i18n";

export function StatValue({ celsius }: { celsius: number }) {
  return <TempDisplay celsius={celsius} precision={0} />;
}

/**
 * Client-side translated label for a stat card.
 * Rendered inside an RSC parent — must live in a client boundary because
 * `useT()` reads localStorage-backed preferences on the client.
 */
export function StatLabel({ tKey }: { tKey: string }) {
  const t = useT();
  return <>{t(tKey)}</>;
}
