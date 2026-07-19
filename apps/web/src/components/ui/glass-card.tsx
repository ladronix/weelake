import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "light" | "dark" | "solid";
  radius?: "2xl" | "3xl" | "4xl" | "5xl" | "full";
  hover?: boolean;
}

const VARIANT = {
  light: "bg-white/80 backdrop-blur-md border border-white/60",
  dark:  "bg-deep/60 backdrop-blur-xl border border-white/10 text-white",
  solid: "bg-white border border-water-100/70",
};

const RADIUS = {
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  "4xl": "rounded-4xl",
  "5xl": "rounded-5xl",
  full:  "rounded-full",
};

/**
 * Frosted-glass card. Base surface for every grouped block in the UI.
 */
export function GlassCard({
  children,
  variant = "light",
  radius = "3xl",
  hover,
  className,
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        VARIANT[variant],
        RADIUS[radius],
        "shadow-[0_8px_30px_rgba(14,165,233,0.08)]",
        hover && "hover:shadow-[0_12px_40px_rgba(14,165,233,0.16)] hover:-translate-y-0.5 transition-all",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
