import { ImageResponse } from "next/og";
import { StockcardMark } from "./icons/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<StockcardMark px={180} />, { ...size });
}
