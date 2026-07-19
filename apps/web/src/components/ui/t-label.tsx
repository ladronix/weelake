"use client";

import { useT, useP } from "@/lib/i18n";

/**
 * TLabel — thin i18n island for use inside RSC / server components.
 * Renders `t(tKey, vars)` inside a React fragment.
 */
export function TLabel({
  tKey,
  vars,
}: {
  tKey: string;
  vars?: Record<string, string | number>;
}) {
  const t = useT();
  return <>{t(tKey, vars)}</>;
}

/** Plural island: `p(baseKey, count, vars?)`. */
export function PLabel({
  baseKey,
  count,
  vars,
}: {
  baseKey: string;
  count: number;
  vars?: Record<string, string | number>;
}) {
  const p = useP();
  return <>{p(baseKey, count, vars)}</>;
}
