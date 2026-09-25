import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "StockCard — Spend what you own. Never sell it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#07090C",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#F3F5F7", fontSize: 34, fontWeight: 600 }}>StockCard</span>
          <span style={{ color: "#7FE3C4", fontSize: 20, letterSpacing: 4 }}>
            BUILT ON SOLANA · DEVNET BETA
          </span>
        </div>
        {/* metal card render */}
        <div
          style={{
            display: "flex",
            width: 560,
            height: 350,
            borderRadius: 28,
            background: "linear-gradient(135deg,#2A2D31,#0C0D0F 55%,#1F2124)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: 36,
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "#F3F5F7" }}>
            <span style={{ fontSize: 28, fontWeight: 600 }}>StockCard</span>
          </div>
          <div
            style={{
              width: 64,
              height: 48,
              borderRadius: 8,
              background: "linear-gradient(135deg,#3A3E44,#22252A)",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", color: "#9AA4B2", fontSize: 22 }}>
            <span style={{ letterSpacing: 6 }}>•••• •••• •••• ••••</span>
            <span style={{ letterSpacing: 6 }}>VISA</span>
          </div>
        </div>
        <span style={{ color: "#F3F5F7", fontSize: 64, fontWeight: 600, lineHeight: 1.1 }}>
          Spend what you own. Never sell it.
        </span>
      </div>
    ),
    { ...size }
  );
}
