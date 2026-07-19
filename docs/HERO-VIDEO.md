# Hero background video — how to generate

The landing page hero has a **progressive-enhancement backdrop**:

1. **Fallback (always on):** animated SVG mountain silhouette with subtle water waves.
2. **Optional upgrade:** if you drop a real short video into `apps/web/public/videos/hero-lake.mp4`, it will loop over the SVG at ~80% opacity for an extra "wow" hit.

The web app *never* fetches a missing video (a HEAD preflight gates the mount), so shipping without a video is fine.

## Recommended specs

| Property | Value |
|---|---|
| Resolution | 1920×1080 (16:9) or 1440×900 |
| Duration | 6–10 seconds (looping) |
| File size | ≤ 4 MB for MP4, ≤ 2 MB for WebM |
| Frame rate | 24–30 fps |
| Codec | H.264 (MP4) + VP9 (WebM as fallback) |
| Audio | **muted / stripped** (autoplay requires it) |
| Loop | seamless — first and last frame identical or dissolvable |
| Colour palette | cool blues, whites — matches `#0EA5E9 → #0369A1` gradient |
| Motion | slow drone flyover / gentle water ripple |

## AI generation prompts

Use one of these — copy the prompt into your favourite video model
(Runway, Kling, Pika, Sora, Google Veo, Luna Dream Machine).

### Prompt 1 — Serene mountain lake (recommended)

> Aerial drone flyover of a crystal-clear mountain lake at golden hour.
> Camera slowly moves forward and slightly downward.
> Alpine peaks reflect in the still turquoise water.
> Soft ripples on the surface, no boats, no people.
> Cinematic, ultra-realistic, 8-second seamless loop, 24 fps.
> Cool blue and cyan palette. No text.

### Prompt 2 — Nordic fjord

> Slow drone shot gliding over a deep blue Nordic fjord.
> Gentle wind ripples on the water, misty mountains on either side.
> Overcast soft daylight, no direct sun.
> 8-second loop, cinematic, 4K. Cold blue palette.

### Prompt 3 — Wild swimmer view

> First-person view slowly gliding just above a calm mountain lake.
> Small waves catching soft afternoon light.
> Forested shore in the far distance.
> Seamless 6-second loop. Muted blues and greens. Ultra-real.

## After generation

1. Compress to target size:
   ```bash
   # From a source file (source.mp4)
   ffmpeg -i source.mp4 -vcodec libx264 -crf 26 -preset slow \
          -movflags +faststart -pix_fmt yuv420p -an \
          apps/web/public/videos/hero-lake.mp4
   ffmpeg -i source.mp4 -c:v libvpx-vp9 -crf 32 -b:v 0 -an \
          apps/web/public/videos/hero-lake.webm
   ```
2. Also generate a poster frame (used while the video buffers):
   ```bash
   ffmpeg -i apps/web/public/videos/hero-lake.mp4 -vframes 1 -q:v 2 \
          apps/web/public/videos/hero-lake-poster.jpg
   ```
3. **Enable the video via env var** — the SVG hero is on by default,
   the video is opt-in to keep dev consoles quiet:
   ```
   NEXT_PUBLIC_HERO_VIDEO=1
   ```
4. Commit the files, redeploy — the hero will mount the video automatically.

## Free alternatives

- **Coverr.co** — free stock loops (search "lake", "mountain lake")
- **Pexels** — free-license stock video
- **Wikimedia Commons** — public-domain nature footage
- **NASA Worldview** — free satellite time-lapses (unique angle)

Save the credit line in `docs/CREDITS.md` and cite the source in the footer
if the licence requires attribution.

## Nano-banana / Gemini image → video

If you only have a still image (e.g. generated with Nano Banana / Gemini
Imagen / Flux):

1. Generate the still with a prompt like:
   > "Alpine mountain lake at golden hour, calm turquoise water, cinematic
   >  wide shot, no people, ultra-realistic, 16:9"
2. Feed the still into a video model (Runway Gen-3 → "Motion Brush" for
   subtle water ripples; Luma Dream Machine → "generate video from image")
3. Follow the compression steps above.

## Skip the video entirely

Ship without it. The SVG hero is deliberately designed to look like a
finished production choice, not a placeholder. Add a video later when you
have a clip you love.
