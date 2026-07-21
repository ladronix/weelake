/**
 * Image proxy — server-side fetches a remote image URL and streams
 * it back with correct CORS/cache headers. Solves two problems:
 *
 * 1) Cross-origin restrictions. Browsers (especially Chromium with
 *    Cross-Origin-Read-Blocking on non-image content-types) can
 *    refuse to render remote images even when the upstream server
 *    sends `access-control-allow-origin: *`. By fetching server-side
 *    we hand the browser a same-origin resource — no CORS to fight.
 *
 * 2) Broken URLs and encoding quirks. Wikimedia specifically returns
 *    an HTML redirect page (content-type text/html) for URLs that
 *    contain URL-encoded characters like %2C — the actual image is
 *    at a slightly different path. This proxy follows redirects and
 *    ensures we deliver whatever bytes come back last.
 *
 * Not a bytes-cache — Vercel/CDN in front of the API route handles
 * long-lived caching via the s-maxage below.
 */
import { NextRequest, NextResponse } from "next/server";

// Only a small allowlist so this can't be turned into an open proxy.
const ALLOWED_HOSTS = new Set([
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "en.wikipedia.org",
]);

// Simple in-memory dedupe cache. Two concurrent requests for the same
// URL share the same upstream fetch — this is what saves us from
// Wikimedia's aggressive 429 rate limits when a page renders 20 lake
// cards at once and each `<img>` triggers a separate proxy call.
// Keyed by absolute upstream URL. Cleared once the response body has
// been fully buffered (below).
const inflight = new Map<string, Promise<Response>>();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("url");
  if (!src) return new NextResponse("missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse("host not allowed", { status: 400 });
  }

  const key = parsed.toString();
  let promise = inflight.get(key);
  if (!promise) {
    promise = fetch(key, {
      headers: {
        // Wikimedia enforces a User-Agent policy — anonymous UAs are
        // rate-limited or outright blocked.
        "User-Agent": "Weelake/1.0 (https://weelake.com; hello@weelake.com)",
        // Ask Wikimedia to bill this against browser cache when possible.
        "Accept": "image/webp,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      // Node fetch cache (Next.js)
      next: { revalidate: 86400 },
    });
    inflight.set(key, promise);
    // Clear on the next tick — the browser cache + s-maxage below
    // is the real long-term cache, this is only for concurrent
    // in-flight dedup.
    promise.finally(() => setTimeout(() => inflight.delete(key), 0));
  }

  const upstream = await promise.then((r) => r.clone());

  if (!upstream.ok) {
    return new NextResponse(`upstream ${upstream.status}`, { status: upstream.status });
  }
  const ct = upstream.headers.get("content-type") ?? "";
  if (!ct.startsWith("image/")) {
    // Wikimedia sometimes returns an HTML redirect page — treat as
    // 404 so the browser's onError swaps in our gradient fallback.
    return new NextResponse("not an image", { status: 404 });
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": ct,
      // Cache aggressively at the edge: image URLs are content-hashed
      // by Wikimedia so 1 day is safe and cheap.
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
