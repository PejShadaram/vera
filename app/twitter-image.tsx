import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Vera — Legal Case Management for Self-Represented Litigants";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#111827",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          position: "relative",
        }}
      >
        {/* Logo mark — top left */}
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 96,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="22" fill="#C2853A" />
            <path
              d="M13 15L22 30L31 15"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              color: "#F9FAFB",
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: "-0.5px",
            }}
          >
            Vera
          </span>
        </div>

        {/* Main headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              color: "#F9FAFB",
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-2px",
              maxWidth: 900,
            }}
          >
            Don&apos;t go to court unprepared.
          </div>
          <div
            style={{
              color: "#C2853A",
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.5px",
            }}
          >
            veracase.app
          </div>
        </div>

        {/* Subtle descriptor */}
        <div
          style={{
            position: "absolute",
            bottom: 56,
            left: 96,
            color: "#6B7280",
            fontSize: 22,
            fontWeight: 400,
          }}
        >
          Legal case management for self-represented litigants
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
