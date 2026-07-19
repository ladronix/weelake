import type { ReactNode } from "react";
import { HeroCopy } from "./hero-copy";

export function Hero({ children }: { children?: ReactNode }) {
  return (
    <section className="section pt-8 sm:pt-14 pb-4 relative">
      <HeroCopy />

      <div className="mt-7 sm:mt-9 max-w-2xl mx-auto">
        {children}
      </div>
    </section>
  );
}
