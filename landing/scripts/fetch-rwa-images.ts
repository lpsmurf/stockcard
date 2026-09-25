// Downloads the RWA example images (Collector Crypt API + open-licensed) into
// public/assets/rwa/ and converts them to WebP with sharp. Run with:
//   npm run fetch-images
// Don't hotlink in production — data files point at these local paths while
// keeping the original URL in `sourceUrl` for attribution.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { RWA_EXAMPLES, OPEN_RWA_IMAGES } from "../src/data/rwa-examples";

const ROOT = path.resolve(__dirname, "..", "public");

async function downloadToWebp(url: string, destAbs: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).webp({ quality: 82 }).toFile(destAbs);
}

async function main() {
  const failures: string[] = [];
  const jobs: { url: string; rel: string }[] = [
    ...RWA_EXAMPLES.map((e) => ({ url: e.sourceUrl, rel: e.image })),
    ...OPEN_RWA_IMAGES.map((e) => ({ url: e.sourceUrl, rel: e.image })),
  ];

  for (const { url, rel } of jobs) {
    const destAbs = path.join(ROOT, rel);
    await mkdir(path.dirname(destAbs), { recursive: true });
    try {
      await downloadToWebp(url, destAbs);
      console.log(`ok  ${rel}`);
    } catch (err) {
      // If sharp can't parse it (rare), store the raw bytes at the .webp path
      // won't work for next/image — record the failure and move on.
      failures.push(`${rel} ← ${url}: ${(err as Error).message}`);
      console.error(`FAIL ${rel}: ${(err as Error).message}`);
    }
  }

  await writeFile(
    path.join(ROOT, "assets", "rwa", "FETCH_LOG.txt"),
    `Fetched ${new Date().toISOString()}\n${failures.length ? "FAILURES:\n" + failures.join("\n") : "No failures."}\n`
  );

  if (failures.length) {
    console.log(`\n${failures.length} failure(s):\n${failures.join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${jobs.length} images fetched and converted to WebP.`);
  }
}

main();
