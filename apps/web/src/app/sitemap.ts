import type { MetadataRoute } from "next";
import { createSupabaseServiceClient } from "@/lib/supabase";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://weelake.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createSupabaseServiceClient();
  const [{ data: lakes }, { data: countries }] = await Promise.all([
    supabase.from("lakes").select("slug, updated_at").limit(50000),
    supabase.from("countries").select("code").eq("featured", true),
  ]);

  const now = new Date();

  return [
    { url: `${SITE}/`,    lastModified: now, changeFrequency: "hourly",  priority: 1.0 },
    { url: `${SITE}/map`, lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    ...(countries ?? []).map((c) => ({
      url: `${SITE}/country/${c.code.toLowerCase()}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...(lakes ?? []).map((l) => ({
      url: `${SITE}/lake/${l.slug}`,
      lastModified: l.updated_at ? new Date(l.updated_at) : now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
