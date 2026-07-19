"use client";

import { TempDisplay } from "@/components/ui";

export function StatValue({ celsius }: { celsius: number }) {
  return <TempDisplay celsius={celsius} precision={0} />;
}
