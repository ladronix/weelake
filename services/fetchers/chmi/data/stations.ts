/**
 * Weelake · CHMI station registry
 *
 * ================================================================
 * FINDING: The ChMI public gauge network is not a good fit for the
 * Weelake use case (swim-safety surface temperature).
 * ================================================================
 *
 * We ran a comprehensive scan (`pnpm --filter @weelake/fetcher-chmi
 * scan`) of ~560 ChMI gauge stations. 238 reported a water
 * temperature. But every station that spatially matches a Czech
 * reservoir turned out to be one of:
 *
 *   - an OUTFLOW station just below the dam. These measure the water
 *     that comes out of the hypolimnion (bottom, cold) — e.g.
 *     Slezská Harta reports 4.8°C in July because the reservoir
 *     draws from its cold deep layer. Useless for swim UX.
 *
 *   - an INFLOW / river station on a tributary or downstream reach.
 *     These read the tributary temperature, not the reservoir surface.
 *
 * There are NO ChMI stations sitting on a Czech reservoir surface.
 * Wading in surface data is a Povodí business, not ChMI's.
 *
 * We keep this fetcher wired up as INFRASTRUCTURE (the shared
 * fetcher-lib is exercised by having two consumers, and adding a
 * new source later is now a one-file change), but the production
 * schedule ships EMPTY — see below.
 *
 * If a good station shows up in the future (e.g. Povodí publishes a
 * proper JSON feed, or a smart-buoy program starts reporting to
 * ChMI), drop it in here with a note explaining why it's the
 * exception.
 */
export interface ChmiStation {
  seq: number;
  slug: string;
  kind: "reservoir" | "lake" | "river-in-lake";
  name: string;
  /** Explanatory note — station name + water body from ChMI. */
  note?: string;
}

/**
 * PRODUCTION SET — currently EMPTY. See module-level comment.
 *
 * (Historical: this list used to contain 10 auto-matched CHMI
 * stations that were producing physically wrong readings because
 * they measure outflow / river temperatures rather than reservoir
 * surface. Removed in commit that added this comment.)
 */
export const CHMI_STATIONS: ChmiStation[] = [];
