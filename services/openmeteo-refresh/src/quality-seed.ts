/**
 * Weelake · Water quality mock backfill
 *
 * Generates a heuristic quality_index + algae_risk for every lake based on
 * current water temperature + surface area (larger colder lakes tend to have
 * lower algae risk). Placeholder until Copernicus chlorophyll-a integration.
 *
 * Usage:
 *   pnpm --filter openmeteo-refresh exec tsx src/quality-seed.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Row {
  lake_id: string;
  temp_c: number | null;
  area_km2: number | null;
  elevation_m: number | null;
  type: string;
}

function heuristic(row: Row) {
  const t = row.temp_c ?? 15;
  const area = row.area_km2 ?? 5;
  const elev = row.elevation_m ?? 300;
  const isReservoir = row.type === "reservoir";

  // Algae risk grows with warm water + shallow + low elevation.
  let algaeScore = 0;
  if (t > 22) algaeScore += 40;
  else if (t > 18) algaeScore += 20;
  else if (t > 14) algaeScore += 5;
  if (area < 5) algaeScore += 15;
  if (elev < 200) algaeScore += 15;
  if (isReservoir) algaeScore += 10;

  const algae_risk: "low" | "moderate" | "high" =
    algaeScore >= 60 ? "high" : algaeScore >= 35 ? "moderate" : "low";

  // Quality index: 100 - proxy of pressure. Inverted algae + some noise.
  const base = 100 - algaeScore;
  // Boost alpine lakes.
  const alpineBoost = elev > 800 ? 8 : elev > 500 ? 4 : 0;
  const qi = Math.max(20, Math.min(100, Math.round(base + alpineBoost)));

  // Turbidity: alpine ~ 0.5-2 NTU; lowland shallow ~ 5-15 NTU.
  const turbidity =
    qi >= 85 ? 1 + Math.random() * 1.5 :
    qi >= 70 ? 2 + Math.random() * 3 :
    qi >= 55 ? 5 + Math.random() * 5 :
                8 + Math.random() * 10;

  return {
    quality_index: qi,
    algae_risk,
    turbidity_ntu: Number(turbidity.toFixed(1)),
  };
}

async function main() {
  const { data, error } = await supabase
    .from("lakes")
    .select("id, area_km2, elevation_m, type, lakes_current:lakes_current(temp_c)");
  if (error) { console.error(error); process.exit(1); }
  const rows = (data ?? []).map((r) => {
    const cur = Array.isArray(r.lakes_current) ? r.lakes_current[0] : r.lakes_current;
    return {
      lake_id: r.id,
      temp_c: cur?.temp_c != null ? Number(cur.temp_c) : null,
      area_km2: r.area_km2 != null ? Number(r.area_km2) : null,
      elevation_m: r.elevation_m != null ? Number(r.elevation_m) : null,
      type: r.type,
    } as Row;
  });

  console.log(`Seeding water quality for ${rows.length} lakes…`);
  let ok = 0;
  for (const row of rows) {
    const q = heuristic(row);
    const { error: e } = await supabase
      .from("lakes_current")
      .update(q)
      .eq("lake_id", row.lake_id);
    if (e) console.error(`[${row.lake_id.slice(0, 8)}] ${e.message}`);
    else ok++;
  }
  console.log(`Done. ok=${ok}/${rows.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
