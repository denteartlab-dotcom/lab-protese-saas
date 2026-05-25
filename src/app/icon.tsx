import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #22d3ee 0%, #3b82f6 55%, #7c3aed 100%)",
          borderRadius: 7,
          position: "relative",
        }}
      >
        <div
          style={{
            width: 14,
            height: 18,
            background: "white",
            borderRadius: "45% 45% 35% 35%",
            marginTop: -2,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 5,
            left: 6,
            width: 14,
            height: 4,
            background: "white",
            borderRadius: 2,
            transform: "rotate(-42deg)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
