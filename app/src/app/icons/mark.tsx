/** Shared StockCard app-icon mark. Colors come from globals.css tokens: plaster / brass / on-brass. */
const PLASTER = "#e9ece8";
const BRASS = "#8e6a22";
const ON_BRASS = "#ffffff";

export function StockcardMark({ px, maskable = false }: { px: number; maskable?: boolean }) {
  // Maskable icons get cropped to a circle/squircle: keep everything inside the central 80%.
  const pad = maskable ? px * 0.1 : 0;
  const card = px - pad * 2;
  const chip = card * 0.16;
  return (
    <div
      style={{
        width: px,
        height: px,
        background: PLASTER,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: card,
          height: card,
          borderRadius: maskable ? card * 0.22 : card * 0.2,
          background: BRASS,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: card * 0.16,
        }}
      >
        <div
          style={{
            width: chip * 1.25,
            height: chip,
            borderRadius: chip * 0.25,
            background: ON_BRASS,
            display: "flex",
          }}
        />
        <div
          style={{
            marginTop: "auto",
            width: "100%",
            height: card * 0.09,
            borderRadius: card * 0.045,
            background: ON_BRASS,
            opacity: 0.85,
            display: "flex",
          }}
        />
        <div
          style={{
            marginTop: card * 0.05,
            width: "62%",
            height: card * 0.09,
            borderRadius: card * 0.045,
            background: ON_BRASS,
            opacity: 0.55,
            display: "flex",
          }}
        />
      </div>
    </div>
  );
}
