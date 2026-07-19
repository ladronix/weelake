"use client";

import { useP, useT } from "@/lib/i18n";

/** Client-side localised region heading. */
export function RegionHeading({ region }: { region: string }) {
  const t = useT();
  const key = `countries.region.${region}`;
  const label = t(key);
  return <>{label === key ? region : label}</>;
}

/** Client-side "3 zeme · 12 jezer" line for a region. */
export function RegionSummary({
  countryCount,
  lakeCount,
}: {
  countryCount: number;
  lakeCount: number;
}) {
  const p = useP();
  return (
    <>
      {p("countries.countCountry", countryCount)} · {p("countries.countLake", lakeCount)}
    </>
  );
}

/** Client-side plural for a single country card (e.g. "3 lakes"). */
export function LakeCount({ n }: { n: number }) {
  const p = useP();
  return <>{p("countries.countLake", n)}</>;
}
