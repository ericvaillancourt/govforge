import { ImageResponse } from "next/og";

/**
 * Apple touch icon (180×180). Same composition as `icon.tsx` but rendered
 * larger so iOS launchers don't upscale a 32 px source.
 */

export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#0f172a",
          borderRadius: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64" fill="none">
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
