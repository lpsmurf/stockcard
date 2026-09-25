// Data per specs/002-landing-site/assets.md.
// Collector Crypt items: real tokenized items on Solana, images pulled from the
// public Collector Crypt marketplace API. Required caption wherever shown:
// "Example of a tokenized item on Solana (Collector Crypt marketplace). Not affiliated with StockCard."
// `image` is the local path after scripts/fetch-rwa-images.ts runs;
// `sourceUrl` keeps the original URL for attribution.

export type RwaExample = {
  category: "Watch" | "Pokemon" | "One Piece";
  name: string;
  grade?: string;
  insuredValueUsd: number;
  mint: string;
  image: string;
  sourceUrl: string;
};

export const RWA_EXAMPLES: RwaExample[] = [
  {
    category: "Watch",
    name: 'Rolex "John Mayer" Daytona',
    grade: "Wristcheck 10",
    insuredValueUsd: 106_000,
    mint: "C4cdjVrisbKvc1jp1YTY5ZBXAqSCuWcMtiQFyyPvVkuP",
    image: "/assets/rwa/rolex-john-mayer-daytona.webp",
    sourceUrl: "https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Rolex%20John%20Mayer%20Daytona.png",
  },
  {
    category: "Watch",
    name: 'Rolex "Tiffany" Daytona',
    grade: "Wristcheck 10",
    insuredValueUsd: 102_820,
    mint: "Hiamzq5eXGnrpaEpKEQPX3iv6bWWbr6UTTn5At9r15Lk",
    image: "/assets/rwa/rolex-tiffany-daytona.webp",
    sourceUrl: "https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Rolex%20Tiffany%20Daytona.png",
  },
  {
    category: "Watch",
    name: "Patek Philippe Aquanaut – Black Strap",
    grade: "Wristcheck 10",
    insuredValueUsd: 101_101,
    mint: "DvRfBPJtaGku947mj5MSRYTa8qRCmcNyz4xcsiELTSLW",
    image: "/assets/rwa/patek-philippe-aquanaut-black-strap.webp",
    sourceUrl: "https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Patek%20Philippe%20Aquanaut%20-%20Black%20Strap.png",
  },
  {
    category: "Watch",
    name: "Audemars Piguet Royal Oak – Silver Dial",
    grade: "Wristcheck 10",
    insuredValueUsd: 51_315,
    mint: "9eJp743HKt419copSHXzwUYSspWRu6e2wVRt4MgHv4BT",
    image: "/assets/rwa/audemars-piguet-royal-oak-silver-dial.webp",
    sourceUrl: "https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Audemars%20Piguet%20Royal%20Oak%20-%20Silver%20Dial.png",
  },
  {
    category: "Watch",
    name: 'Rolex "Pikachu" Daytona',
    grade: "Wristcheck 10",
    insuredValueUsd: 74_200,
    mint: "78YCXVuy3x7Rbq4MLMrcJqzq5nvYEtoHS6ww2TisR7tE",
    image: "/assets/rwa/rolex-pikachu-daytona.webp",
    sourceUrl: "https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Rolex%20Pikachu%20Daytona.png",
  },
  {
    category: "Pokemon",
    name: "1999 Charizard 1st Edition Base Set",
    grade: "PSA GEM-MT 10",
    insuredValueUsd: 550_000,
    mint: "FqPYp3bnsP9LBF8h34VW9FJUPuKvGMwYjsHSqy1rLeJ6",
    image: "/assets/rwa/charizard-1st-edition-psa10.webp",
    sourceUrl: "https://arweave.net/--E_bGkuVwq_m5LoZ3F2w9MvVducOyI7lpnMH9CWbc0",
  },
  {
    category: "Pokemon",
    name: "2002 Pikachu Reverse Foil Legendary Collection",
    grade: "PSA GEM-MT 10",
    insuredValueUsd: 400_000,
    mint: "D2Ww4JQowDCgC8y9kpR71Ua9tooEsqYVvWGy9gCziPK4",
    image: "/assets/rwa/pikachu-reverse-foil-psa10.webp",
    sourceUrl: "https://d1xpxki1g4htqu.cloudfront.net/Rp8fz5fod2l6UkAcEAbKDkF2WJZXCcJsNzrMEpz_NTI",
  },
  {
    category: "Pokemon",
    name: "2011 Lugia Holo Call of Legends",
    grade: "PSA GEM-MT 10",
    insuredValueUsd: 250_000,
    mint: "H1sSmJcCVdepcPQTVgD8JkjiMzn1AMRJ8i5HqawssH47",
    image: "/assets/rwa/lugia-holo-call-of-legends-psa10.webp",
    sourceUrl: "https://arweave.net/iq60q8zAlQLGTZqlK3d5zCN6laB0J2AZf7mbk_fR-_4",
  },
  {
    category: "Pokemon",
    name: "2002 Charizard Reverse Foil Legendary Collection",
    grade: "PSA GEM-MT 10",
    insuredValueUsd: 220_000,
    mint: "GXeVdn2LWkCTuhhfwi4uLyHgqoWTotL2Amd52QMn67SZ",
    image: "/assets/rwa/charizard-reverse-foil-psa10.webp",
    sourceUrl: "https://arweave.net/ntv2V5n6Iq0Hld8pjTzrPU91iGevwsvZ8PM8FYyq3_A",
  },
  {
    category: "Pokemon",
    name: "1999 Gengar Holo Japanese Vending",
    grade: "PSA GEM-MT 10",
    insuredValueUsd: 207_000,
    mint: "7Sy7Si8ZEHV5BJxQrztAp27zVmyLeZQcrz3hHw8D8Daj",
    image: "/assets/rwa/gengar-holo-psa10.webp",
    sourceUrl: "https://arweave.net/j-tjnJ7M6Ep2TR--u6gutB5luwSQjE7__s7BW8JY9h0",
  },
  {
    category: "Pokemon",
    name: "2002 Lugia Holo 1st Edition Wind From the Sea",
    grade: "PSA GEM-MT 10",
    insuredValueUsd: 54_000,
    mint: "CUpou3UTPdojBWVuyMGPDoJAyoeMEcwTuTqFWy8GVfs9",
    image: "/assets/rwa/lugia-holo-1st-edition-psa10.webp",
    sourceUrl: "https://arweave.net/5Erti7ZqY_4m65qdlpUA3TUA-0PVtY_nEyJUCRU6_fQ",
  },
  {
    category: "One Piece",
    name: "2026 Monkey.D.Luffy SEC Treasure Cup Top 8 Prize",
    grade: "Beckett g10b",
    insuredValueUsd: 105_000,
    mint: "53oH1ek1aFm6tRU3NJFoMwAU6HiZaoms6iTRakfZsz13",
    image: "/assets/rwa/luffy-sec-treasure-cup-bgs10.webp",
    sourceUrl: "https://d1xpxki1g4htqu.cloudfront.net/ifHXNvLFf2Vh5G6Mu6bsMI55TZl5Y0_J0K7PQFKoH0M",
  },
];

export const RWA_CAPTION =
  "Example of a tokenized item on Solana (Collector Crypt marketplace). Not affiliated with StockCard.";

// Open-licensed images (assets.md "Open-licensed images"). Recommended hero set:
// Rolex Submariner 16613 (PD), Patek Nautilus 5711 (CC BY-SA), T206 Ty Cobb (PD),
// T206 Honus Wagner (CC BY). Credits belong in a small "Image credits" footer block.
export type OpenRwaImage = {
  name: string;
  kind: "watch" | "card";
  license: string;
  credit?: string; // required credit line; undefined = public domain
  image: string; // local path after download
  sourceUrl: string; // original file URL
  sourcePage: string; // Wikimedia Commons / Flickr page for attribution
};

export const OPEN_RWA_IMAGES: OpenRwaImage[] = [
  {
    name: "Rolex Submariner 16613",
    kind: "watch",
    license: "Public domain",
    image: "/assets/rwa/open/rolex-submariner-16613.webp",
    sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/7/75/Rolex_Submariner_watch_16613.JPG",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Rolex_Submariner_watch_16613.JPG",
  },
  {
    name: "Patek Philippe Nautilus 5711",
    kind: "watch",
    license: "CC BY-SA 4.0",
    credit: "Patek Philippe SA / Wikimedia Commons, CC BY-SA 4.0",
    image: "/assets/rwa/open/patek-philippe-nautilus-5711.webp",
    sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/7/74/Patek-Philippe-Nautilus-5711.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Patek-Philippe-Nautilus-5711.jpg",
  },
  {
    name: "1909–11 T206 Ty Cobb (bat off shoulder)",
    kind: "card",
    license: "Public domain",
    image: "/assets/rwa/open/t206-ty-cobb.webp",
    sourceUrl: "https://upload.wikimedia.org/wikipedia/commons/9/99/1909-11_T206_Ty_Cobb_bat-off-shoulder.jpg",
    sourcePage: "https://commons.wikimedia.org/wiki/File:1909-11_T206_Ty_Cobb_bat-off-shoulder.jpg",
  },
  {
    name: "1909–11 T206 Honus Wagner",
    kind: "card",
    license: "CC BY 2.0 (photo); card is public domain",
    credit: "daveynin / Flickr, CC BY 2.0",
    image: "/assets/rwa/open/t206-honus-wagner.webp",
    sourceUrl: "https://live.staticflickr.com/65535/53931168355_7683dafe97_b.jpg",
    sourcePage: "https://www.flickr.com/photos/44124370018@N01/53931168355",
  },
];
