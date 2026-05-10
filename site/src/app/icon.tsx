import { ImageResponse } from "next/og";

/**
 * Programmatic favicon generated at build time. Next renders this once
 * during `next build` and emits a 32×32 PNG; for the static export the
 * URL becomes `/icon.png`.
 *
 * The composition matches `public/brand/mark-filled.svg`: a charcoal
 * rounded square with a reversed-out G glyph. We use SVG paths inside
 * `ImageResponse` (which is satori under the hood) so the artwork
 * stays vector-crisp at every density.
 */

export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0f172a",
          borderRadius: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
          <path
            d="M40 22 H26 a8 8 0 0 0 -8 8 v4 a8 8 0 0 0 8 8 h6 a4 4 0 0 0 4 -4 v-4 H30"
            stroke="white"
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M44 38 v6" stroke="white" strokeWidth={6} strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
