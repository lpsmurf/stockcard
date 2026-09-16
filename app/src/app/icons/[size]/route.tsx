import { ImageResponse } from "next/og";
import { StockcardMark } from "../mark";

/** PWA install icons: /icons/192, /icons/512 and /icons/maskable-512 (central 80% safe zone). */
const SIZES: Record<string, { px: number; maskable: boolean }> = {
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  "maskable-512": { px: 512, maskable: true },
};

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const entry = SIZES[size];
  if (!entry) return new Response("Unknown icon size", { status: 404 });
  return new ImageResponse(<StockcardMark px={entry.px} maskable={entry.maskable} />, {
    width: entry.px,
    height: entry.px,
  });
}
