# Landing assets: real cards and watches

Pulled on **Sept 14, 2026** from the public Collector Crypt marketplace API (`GET https://api.collectorcrypt.com/marketplace?orderBy=priceDesc`). Every image URL below returned HTTP 200/206 that day. "Insured value" is Collector Crypt's `insuredValue` field in USD, not a price we set.

Collector Crypt lists 148k+ tokenized items, including **545 watches** (Rolex, Patek Philippe, Audemars Piguet, IWC, Omega) and 85k Pokémon cards, so it covers both the "graded cards" and "luxury watches" stories. Phygitals and Beezie have no public API, so no images from them here.

## Open-licensed images (use these first)

Found Sept 14, 2026 via Wikimedia Commons and Openverse with commercial-use licenses. **No permission request needed**: public domain images need nothing; CC BY / CC BY-SA need the credit line shown (put credits in a small "Image credits" block in the footer). Trademarks still apply: show watch brands as examples of assets, never as endorsements, and don't use brand logos in the UI.

The T206 baseball cards (1909–1911) are among the most valuable trading cards in the world and are public domain, so they're the safest "high-value card" imagery. There are no openly licensed Pokémon card images (the artwork is copyrighted); for Pokémon, use the Collector Crypt API images below.

| Item | License | Size | Required credit | Links |
|---|---|---|---|---|
| Rolex Submariner watch 16613 | Public domain | 2048×1536 | None (public domain) | [file](https://upload.wikimedia.org/wikipedia/commons/7/75/Rolex_Submariner_watch_16613.JPG) · [source](https://commons.wikimedia.org/wiki/File:Rolex_Submariner_watch_16613.JPG) |
| Patek-Philippe-Nautilus-5711 | CC BY-SA 4.0 | 1253×1500 | Credit "Patek Philippe SA / Wikimedia Commons, CC BY-SA 4.0" + share-alike if the image is edited | [file](https://upload.wikimedia.org/wikipedia/commons/7/74/Patek-Philippe-Nautilus-5711.jpg) · [source](https://commons.wikimedia.org/wiki/File:Patek-Philippe-Nautilus-5711.jpg) |
| Patek-Philippe-Nautilus-3700-1A | CC BY-SA 4.0 | 1440×1800 | Credit "Patek Philippe SA / Wikimedia Commons, CC BY-SA 4.0" + share-alike if the image is edited | [file](https://upload.wikimedia.org/wikipedia/commons/6/6e/Patek-Philippe-Nautilus-3700-1A.jpg) · [source](https://commons.wikimedia.org/wiki/File:Patek-Philippe-Nautilus-3700-1A.jpg) |
| Rolex Cosmograph Daytona | CC BY 2.0 | 990×961 | Credit "Matt C / Wikimedia Commons, CC BY 2.0" | [file](https://upload.wikimedia.org/wikipedia/commons/1/1d/Rolex_Cosmograph_Daytona.png) · [source](https://commons.wikimedia.org/wiki/File:Rolex_Cosmograph_Daytona.png) |
| Audemars Piguet Royal Oak Offshore Diver | CC BY-SA 4.0 | 1197×1213 | Credit "Clyde94 / Wikimedia Commons, CC BY-SA 4.0" + share-alike if the image is edited | [file](https://upload.wikimedia.org/wikipedia/commons/1/1e/Audemars_Piguet_Royal_Oak_Offshore_Diver.jpg) · [source](https://commons.wikimedia.org/wiki/File:Audemars_Piguet_Royal_Oak_Offshore_Diver.jpg) |
| Vintage Omega Speedmaster 145.012-67 | CC BY-SA 2.0 | 2400×1600 | Credit "Shane Lin / Wikimedia Commons, CC BY-SA 2.0" + share-alike if the image is edited | [file](https://upload.wikimedia.org/wikipedia/commons/d/d8/Vintage_Omega_Speedmaster_145.012-67.jpg) · [source](https://commons.wikimedia.org/wiki/File:Vintage_Omega_Speedmaster_145.012-67.jpg) |
| 1909-11 T206 Ty Cobb bat-off-shoulder | Public domain | 780×1395 | None (public domain) | [file](https://upload.wikimedia.org/wikipedia/commons/9/99/1909-11_T206_Ty_Cobb_bat-off-shoulder.jpg) · [source](https://commons.wikimedia.org/wiki/File:1909-11_T206_Ty_Cobb_bat-off-shoulder.jpg) |
| Christy Mathewson, New York Giants, ca. 1910 | Public domain | 1661×3000 | None (public domain) | [file](https://upload.wikimedia.org/wikipedia/commons/b/b2/Christy_Mathewson%2C_New_York_Giants%2C_ca._1910.jpg) · [source](https://commons.wikimedia.org/wiki/File:Christy_Mathewson,_New_York_Giants,_ca._1910.jpg) |
| Walter Johnson Baseballcard | Public domain | 362×640 | None (public domain) | [file](https://upload.wikimedia.org/wikipedia/commons/0/05/Walter_Johnson_Baseballcard.jpg) · [source](https://commons.wikimedia.org/wiki/File:Walter_Johnson_Baseballcard.jpg) |
| Audemars Piguet Royal Oak Jumbo 15202 (Flickr, section215) | CC BY 2.0 | 1024×687 | Credit "section215 / Flickr, CC BY 2.0" | [file](https://live.staticflickr.com/7502/16240926996_c8f72cfefe_b.jpg) · [source](https://www.flickr.com/photos/25646902@N00/16240926996) |
| 1909–11 T206 Honus Wagner (Flickr, daveynin) | CC BY 2.0 (photo); card is public domain | 768×1024 | Credit "daveynin / Flickr, CC BY 2.0" | [file](https://live.staticflickr.com/65535/53931168355_7683dafe97_b.jpg) · [source](https://www.flickr.com/photos/44124370018@N01/53931168355) |

Recommended hero set without any permission: **Rolex Submariner 16613** (PD), **Patek Philippe Nautilus 5711** (official Patek photo, CC BY-SA), **T206 Ty Cobb** (PD), **T206 Honus Wagner** (CC BY).

## Collector Crypt API images (real tokenized items on Solana)

### Rights status: read before using

| Use | OK? |
|---|---|
| Local development, design mockups, investor/partner decks shared privately | Yes, with the caption below |
| Public production landing page | Luis approved using API images (Sept 14). Still send a courtesy email to Collector Crypt (support@collectorcrypt.com) and remove on request. Card artwork is © The Pokémon Company / Nintendo / Toei; watch names are trademarks of their makers. Safer default: use the open-licensed images above for hero/marketing, and API images only in the "tokenized on Solana" strip (support@collectorcrypt.com) for the photos. Card artwork is © The Pokémon Company / Nintendo / Toei; watch names are trademarks of their makers |
| Implying partnership, endorsement or that StockCard holds these items | **Never** |

Fallback if permission isn't granted by launch: commission or generate neutral renders (unbranded graded slab, unbranded steel chronograph) and keep the same layout. Kimi should build the asset strip so images are swappable from one data file.

**Required caption**: "Example of a tokenized item on Solana (Collector Crypt marketplace). Not affiliated with StockCard."

**Hotlinking**: don't hotlink in production. Download into `public/assets/rwa/` at build time (or once, after permission), convert to AVIF/WebP, keep the original URL in the data file for attribution.

### Items

| Category | Item | Grade | Insured value | Solana mint | Image | Explorer |
|---|---|---|---|---|---|---|
| Watch | Rolex "John Mayer" Daytona | Wristcheck 10 | $106,000 | `C4cdjVrisbKvc1jp1YTY5ZBXAqSCuWcMtiQFyyPvVkuP` | [image](https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Rolex%20John%20Mayer%20Daytona.png) | [Solscan](https://solscan.io/token/C4cdjVrisbKvc1jp1YTY5ZBXAqSCuWcMtiQFyyPvVkuP) |
| Watch | Rolex "Tiffany" Daytona | Wristcheck 10 | $102,820 | `Hiamzq5eXGnrpaEpKEQPX3iv6bWWbr6UTTn5At9r15Lk` | [image](https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Rolex%20Tiffany%20Daytona.png) | [Solscan](https://solscan.io/token/Hiamzq5eXGnrpaEpKEQPX3iv6bWWbr6UTTn5At9r15Lk) |
| Watch | Patek Philippe Aquanaut - Black Strap | Wristcheck 10 | $101,101 | `DvRfBPJtaGku947mj5MSRYTa8qRCmcNyz4xcsiELTSLW` | [image](https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Patek%20Philippe%20Aquanaut%20-%20Black%20Strap.png) | [Solscan](https://solscan.io/token/DvRfBPJtaGku947mj5MSRYTa8qRCmcNyz4xcsiELTSLW) |
| Watch | Audemars Piguet Royal Oak - Silver Dial | Wristcheck 10 | $51,315 | `9eJp743HKt419copSHXzwUYSspWRu6e2wVRt4MgHv4BT` | [image](https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Audemars%20Piguet%20Royal%20Oak%20-%20Silver%20Dial.png) | [Solscan](https://solscan.io/token/9eJp743HKt419copSHXzwUYSspWRu6e2wVRt4MgHv4BT) |
| Watch | Rolex "Pikachu" Daytona | Wristcheck 10 | $74,200 | `78YCXVuy3x7Rbq4MLMrcJqzq5nvYEtoHS6ww2TisR7tE` | [image](https://d1xpxki1g4htqu.cloudfront.net/uploads/WatchScan/Rolex%20Pikachu%20Daytona.png) | [Solscan](https://solscan.io/token/78YCXVuy3x7Rbq4MLMrcJqzq5nvYEtoHS6ww2TisR7tE) |
| Pokemon | 1999 #4 CHARIZARD 1ST EDITION PSA10 BASE SET / by Charred Treasures | PSA GEM-MT 10 | $550,000 | `FqPYp3bnsP9LBF8h34VW9FJUPuKvGMwYjsHSqy1rLeJ6` | [image](https://arweave.net/--E_bGkuVwq_m5LoZ3F2w9MvVducOyI7lpnMH9CWbc0) | [Solscan](https://solscan.io/token/FqPYp3bnsP9LBF8h34VW9FJUPuKvGMwYjsHSqy1rLeJ6) |
| Pokemon | 2002 #86 Pikachu-Reverse Foil PSA 10 Legendary Collection | PSA GEM-MT 10 | $400,000 | `D2Ww4JQowDCgC8y9kpR71Ua9tooEsqYVvWGy9gCziPK4` | [image](https://d1xpxki1g4htqu.cloudfront.net/Rp8fz5fod2l6UkAcEAbKDkF2WJZXCcJsNzrMEpz_NTI) | [Solscan](https://solscan.io/token/D2Ww4JQowDCgC8y9kpR71Ua9tooEsqYVvWGy9gCziPK4) |
| Pokemon | 2011 #SL7 Lugia-Holo PSA 10 Call of Legends | PSA GEM-MT 10 | $250,000 | `H1sSmJcCVdepcPQTVgD8JkjiMzn1AMRJ8i5HqawssH47` | [image](https://arweave.net/iq60q8zAlQLGTZqlK3d5zCN6laB0J2AZf7mbk_fR-_4) | [Solscan](https://solscan.io/token/H1sSmJcCVdepcPQTVgD8JkjiMzn1AMRJ8i5HqawssH47) |
| Pokemon | 2002 #3 Charizard-Reverse Foil PSA 10 Legendary Collection Pokemon | PSA GEM-MT 10 | $220,000 | `GXeVdn2LWkCTuhhfwi4uLyHgqoWTotL2Amd52QMn67SZ` | [image](https://arweave.net/ntv2V5n6Iq0Hld8pjTzrPU91iGevwsvZ8PM8FYyq3_A) | [Solscan](https://solscan.io/token/GXeVdn2LWkCTuhhfwi4uLyHgqoWTotL2Amd52QMn67SZ) |
| Pokemon | 1999 #94 Gengar-Holo PSA 10 Japanese Vending Pokemon | PSA GEM-MT 10 | $207,000 | `7Sy7Si8ZEHV5BJxQrztAp27zVmyLeZQcrz3hHw8D8Daj` | [image](https://arweave.net/j-tjnJ7M6Ep2TR--u6gutB5luwSQjE7__s7BW8JY9h0) | [Solscan](https://solscan.io/token/7Sy7Si8ZEHV5BJxQrztAp27zVmyLeZQcrz3hHw8D8Daj) |
| Pokemon | 2002 #090 Lugia-Holo 1st Edition PSA 10 Japanese Wind From the Sea Pokemon | PSA GEM-MT 10 | $54,000 | `CUpou3UTPdojBWVuyMGPDoJAyoeMEcwTuTqFWy8GVfs9` | [image](https://arweave.net/5Erti7ZqY_4m65qdlpUA3TUA-0PVtY_nEyJUCRU6_fQ) | [Solscan](https://solscan.io/token/CUpou3UTPdojBWVuyMGPDoJAyoeMEcwTuTqFWy8GVfs9) |
| One Piece | 2026 #OP13118 Monkey.D.Luffy SEC/(Treasure Cup March '26 Top 8 Prize) BGS 10 One Piece Card Game Promos | Beckett g10b | $105,000 | `53oH1ek1aFm6tRU3NJFoMwAU6HiZaoms6iTRakfZsz13` | [image](https://d1xpxki1g4htqu.cloudfront.net/ifHXNvLFf2Vh5G6Mu6bsMI55TZl5Y0_J0K7PQFKoH0M) | [Solscan](https://solscan.io/token/53oH1ek1aFm6tRU3NJFoMwAU6HiZaoms6iTRakfZsz13) |

## Suggested use on the page
- **Asset strip (tokenized on Solana)**: Rolex "John Mayer" Daytona ($106,000) and 1999 Charizard 1st Edition PSA 10 ($550,000). They make "real, high-value, already on Solana" obvious in one glance.
- **Calculator presets**: use rounded example values, not these exact items ("Graded card worth $50,000 → up to $20,000 credit at 40% LTV"), so the calculator never looks like a valuation of someone's item.
- **Watch row**: Rolex Daytona ×3, Patek Philippe Aquanaut, Audemars Piguet Royal Oak.
- **Card row**: Charizard, Pikachu Legendary Collection, Lugia, Gengar, One Piece Luffy BGS 10.

## Data file shape for Kimi
```ts
// landing/src/data/rwa-examples.ts
export type RwaExample = {
  category: "Watch" | "Pokemon" | "One Piece";
  name: string;          // shortened display name, e.g. 'Rolex "John Mayer" Daytona'
  grade?: string;        // e.g. "PSA 10"
  insuredValueUsd: number;
  mint: string;
  image: string;         // local path after download
  sourceUrl: string;     // original Collector Crypt image URL
};
```
