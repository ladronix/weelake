import { AlertTriangle, CheckCircle2, Sparkles, Droplet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  quality_index: number | null;
  algae_risk: "low" | "moderate" | "high" | "unknown" | null;
  turbidity_ntu: number | null;
}

const RISK = {
  low: {
    label: "Low",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    icon: CheckCircle2,
    text: "No known algal bloom risk right now.",
  },
  moderate: {
    label: "Moderate",
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    icon: Sparkles,
    text: "Warm water — check local advisories before swimming.",
  },
  high: {
    label: "High",
    color: "text-red-700",
    bg: "bg-red-50",
    ring: "ring-red-200",
    icon: AlertTriangle,
    text: "Elevated bloom risk. Avoid contact with visible scum.",
  },
  unknown: {
    label: "Unknown",
    color: "text-slate-600",
    bg: "bg-slate-50",
    ring: "ring-slate-200",
    icon: Droplet,
    text: "Not enough data yet.",
  },
};

/**
 * Water quality card — shown on lake detail sidebar.
 * Placeholder heuristic until Copernicus chlorophyll integration lands.
 */
export function WaterQualityCard({ quality_index, algae_risk, turbidity_ntu }: Props) {
  const risk = RISK[algae_risk ?? "unknown"];
  const qi = quality_index ?? 0;
  const barColor =
    qi >= 80 ? "from-emerald-400 to-emerald-600" :
    qi >= 60 ? "from-lime-400 to-emerald-500" :
    qi >= 40 ? "from-amber-400 to-orange-500" :
                "from-red-400 to-red-600";

  const IconEl = risk.icon;

  return (
    <div className="rounded-4xl bg-white/80 backdrop-blur-md border border-white/60 p-5 shadow-[0_8px_30px_rgba(14,165,233,0.08)]">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-2xl bg-water-100 flex items-center justify-center">
          <Droplet className="h-4 w-4 text-water-700" />
        </div>
        <div>
          <div className="font-semibold text-deep">Water quality</div>
          <div className="text-xs text-slate-500">Estimated · placeholder until Copernicus</div>
        </div>
      </div>

      {quality_index != null && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Quality index</span>
            <span className="text-2xl font-semibold text-deep tabular-nums">
              {qi}<span className="text-slate-400 text-sm font-normal">/100</span>
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={cn("h-full rounded-full bg-gradient-to-r", barColor)} style={{ width: `${qi}%` }} />
          </div>
        </div>
      )}

      <div className={cn("mt-4 rounded-2xl px-3 py-2.5 ring-1 flex items-start gap-2", risk.bg, risk.ring)}>
        <IconEl className={cn("h-4 w-4 mt-0.5 shrink-0", risk.color)} />
        <div className="text-xs">
          <div className={cn("font-semibold", risk.color)}>
            Algae risk: {risk.label}
          </div>
          <div className="text-slate-600 mt-0.5">{risk.text}</div>
        </div>
      </div>

      {turbidity_ntu != null && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-500">Turbidity</span>
          <span className="font-medium text-deep tabular-nums">
            {Number(turbidity_ntu).toFixed(1)} NTU
          </span>
        </div>
      )}
    </div>
  );
}
