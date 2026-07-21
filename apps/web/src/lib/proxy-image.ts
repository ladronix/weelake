/**
 * Route an external image URL through our /api/img proxy so the
 * browser sees a same-origin resource (avoids CORS/ORB) and gets
 * consistent caching. Non-external URLs pass through unchanged.
 *
 * Keeping this a pure helper (no React) so both server and client
 * components can call it without pulling extra runtime.
 */
export function proxyImage(src: string | null | undefined): string | null {
  if (!src) return null;
  // Already local — leave it alone.
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  // data: URIs pass through.
  if (src.startsWith("data:")) return src;
  return `/api/img?url=${encodeURIComponent(src)}`;
}
