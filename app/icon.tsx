import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#C2853A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 22 22"
          fill="none"
        >
          <path
            d="M6.5 7.5L11 15L15.5 7.5"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
