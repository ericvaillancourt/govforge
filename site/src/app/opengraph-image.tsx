import { ImageResponse } from "next/og";

/**
 * Default OG image used when a page doesn't override it (1200×630).
 * Composition: dark canvas, mark on the left, wordmark + tagline on the
 * right. Pure satori — no external image fetches, so the build stays
 * deterministic and works in `output: "export"` mode.
 */

export const dynamic = "force-static";
export const alt = "GovForge — Govern AI coding agents before they govern your codebase.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0b1220",
          color: "white",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 22,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <path
                d="M40 22 H26 a8 8 0 0 0 -8 8 v4 a8 8 0 0 0 8 8 h6 a4 4 0 0 0 4 -4 v-4 H30"
                stroke="#0f172a"
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M44 38 v6" stroke="#0f172a" strokeWidth={6} strokeLinecap="round" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            GovForge
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 60,
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 1000,
            }}
          >
            Govern AI coding agents before they govern your codebase.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#94a3b8",
              letterSpacing: "-0.01em",
            }}
          >
            govforge.dev · Apache 2.0 · MCP-native
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
