import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: "glass" | "primary" | "ghost";
  size?: "sm" | "md" | "lg";
  active?: boolean;
}

const SIZE = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const VARIANT = {
  glass:
    "bg-white/95 backdrop-blur text-water-700 hover:bg-white shadow-lg border border-white/60",
  primary:
    "bg-water-500 hover:bg-water-600 text-white shadow-[0_4px_16px_rgba(14,165,233,0.35)]",
  ghost:
    "bg-transparent text-slate-500 hover:bg-water-50 hover:text-water-700",
};

/**
 * Circular icon button used across the map controls, nav, and lists.
 */
export function IconButton({ icon, variant = "glass", size = "md", active, className, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-full transition disabled:opacity-60 disabled:cursor-not-allowed",
        SIZE[size],
        VARIANT[variant],
        active && "ring-2 ring-water-400 ring-offset-2 ring-offset-white/50",
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
