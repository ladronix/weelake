"use client";

import { useEffect, useRef, useState } from "react";

/**
 * V-Lake · Hero background
 *
 * Layered backdrop (all optional, non-blocking):
 *   • Solid water gradient
 *   • Animated blobs and SVG mountain silhouette with looping waves
 *   • Optional /videos/hero-lake.mp4 loop (opt-in via NEXT_PUBLIC_HERO_VIDEO=1)
 *
 * The video is opt-in to avoid noisy 404s during development.
 * See docs/HERO-VIDEO.md to generate one and enable it.
 */
export function HeroBackground() {
  const wantsVideo = process.env.NEXT_PUBLIC_HERO_VIDEO === "1";
  const [videoOk, setVideoOk] = useState(wantsVideo);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!wantsVideo) return;
    const t = setTimeout(() => {
      if (!videoLoaded) setVideoOk(false);
    }, 3500);
    return () => clearTimeout(t);
  }, [videoLoaded, wantsVideo]);

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-water-50 via-water-100 to-water-200" />

      {/* Animated blobs */}
      <div className="absolute -top-20 -left-20 w-[600px] h-[600px] rounded-full bg-water-300/40 blur-3xl animate-float" />
      <div
        className="absolute top-40 -right-32 w-[500px] h-[500px] rounded-full bg-cyan-300/30 blur-3xl animate-float"
        style={{ animationDelay: "2s" }}
      />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-water-400/20 blur-3xl" />

      {/* SVG mountain + lake silhouette (always visible under the hero content) */}
      <svg
        className="absolute bottom-0 inset-x-0 w-full h-72 sm:h-96 pointer-events-none opacity-80"
        viewBox="0 0 1440 400"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="mountBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0369A1" stopOpacity="0.20" />
            <stop offset="1" stopColor="#082F49" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="mountFg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#075985" stopOpacity="0.55" />
            <stop offset="1" stopColor="#082F49" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="lakeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#38BDF8" stopOpacity="0.55" />
            <stop offset="1" stopColor="#0369A1" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        <path
          d="M0,240 L120,160 L220,210 L320,120 L420,190 L520,140 L640,200 L760,110 L880,180 L1000,150 L1140,220 L1280,150 L1440,210 L1440,400 L0,400 Z"
          fill="url(#mountBg)"
        />
        <path
          d="M0,290 L100,240 L210,275 L340,220 L460,270 L580,235 L700,275 L820,225 L960,265 L1080,235 L1220,280 L1340,240 L1440,265 L1440,400 L0,400 Z"
          fill="url(#mountFg)"
        />
        <rect x="0" y="290" width="1440" height="110" fill="url(#lakeGrad)" />
        <g stroke="white" strokeOpacity="0.20" fill="none" strokeWidth="1">
          <path>
            <animate attributeName="d"
              values="M0,310 Q360,300 720,310 T1440,310;
                      M0,310 Q360,320 720,310 T1440,310;
                      M0,310 Q360,300 720,310 T1440,310"
              dur="8s" repeatCount="indefinite" />
          </path>
          <path>
            <animate attributeName="d"
              values="M0,335 Q360,326 720,336 T1440,336;
                      M0,335 Q360,346 720,336 T1440,336;
                      M0,335 Q360,326 720,336 T1440,336"
              dur="10s" repeatCount="indefinite" />
          </path>
          <path>
            <animate attributeName="d"
              values="M0,362 Q360,354 720,364 T1440,364;
                      M0,362 Q360,374 720,364 T1440,364;
                      M0,362 Q360,354 720,364 T1440,364"
              dur="12s" repeatCount="indefinite" />
          </path>
        </g>
      </svg>

      {/* Optional video — silently absent if the file isn't there.
          Uses onCanPlay to prove it loaded; onError disables further attempts. */}
      {videoOk && (
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            videoLoaded ? "opacity-70" : "opacity-0"
          }`}
          autoPlay
          loop
          muted
          playsInline
          onCanPlay={() => setVideoLoaded(true)}
          onError={() => { setVideoOk(false); setVideoLoaded(false); }}
        >
          <source src="/videos/hero-lake.webm" type="video/webm" onError={(e) => e.stopPropagation()} />
          <source src="/videos/hero-lake.mp4"  type="video/mp4"  onError={(e) => e.stopPropagation()} />
        </video>
      )}

      {/* Soft top vignette for header readability */}
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/70 via-white/30 to-transparent" />
    </div>
  );
}
