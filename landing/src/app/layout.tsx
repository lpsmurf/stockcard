import type { Metadata } from "next";
import { Funnel_Display, Funnel_Sans, Martian_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const funnelDisplay = Funnel_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-funnel-display",
});

const funnelSans = Funnel_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-funnel-sans",
});

const martianMono = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-martian-mono",
});

export const metadata: Metadata = {
  title: "StockCard — Spend what you own. Never sell it.",
  description:
    "StockCard is a credit card backed by what you own: tokenized stocks, graded cards, watches and art notes on Solana. Lock assets, borrow USDC, spend — without selling. In development · Devnet beta.",
  openGraph: {
    title: "StockCard — Spend what you own. Never sell it.",
    description:
      "A credit card backed by real assets on Solana. Real assets, not memecoins. In development · Devnet beta.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${funnelDisplay.variable} ${funnelSans.variable} ${martianMono.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
