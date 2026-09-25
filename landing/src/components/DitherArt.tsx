type Props = {
  src: string;
  /** hue-rotate degrees applied after sepia — 205 ≈ the site blue, 150 ≈ mint */
  hue?: number;
  opacity?: number;
  /** which side stays visible: "right" fades toward the left, "center" fades radially */
  fade?: "left" | "right" | "center";
  className?: string;
};

const MASKS: Record<NonNullable<Props["fade"]>, string> = {
  left: "linear-gradient(100deg, #000 0%, #000 40%, transparent 85%)",
  right: "linear-gradient(260deg, #000 0%, #000 42%, transparent 88%)",
  center: "radial-gradient(ellipse 70% 60% at 50% 45%, #000 20%, transparent 75%)",
};

/** Duotone-dithered art plate — same treatment as the AX control room:
 *  grayscale → contrast → sepia → hue-rotate, then a 4px ordered-dither screen. */
export function DitherArt({ src, hue = 205, opacity = 0.45, fade = "right", className = "" }: Props) {
  const mask = MASKS[fade];
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity, WebkitMaskImage: mask, maskImage: mask }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        style={{
          objectPosition: "center 30%",
          filter: `grayscale(1) contrast(1.45) brightness(.72) sepia(1) hue-rotate(${hue}deg) saturate(2)`,
          imageRendering: "pixelated",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, rgba(7,9,12,.92) 1px, transparent 1.4px), " +
            "radial-gradient(circle at 75% 75%, rgba(7,9,12,.92) 1px, transparent 1.4px)",
          backgroundSize: "4px 4px, 4px 4px",
          backgroundPosition: "0 0, 2px 2px",
        }}
      />
    </div>
  );
}
