import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(path.join(ROOT, "app", "package.json"));
const { chromium } = req("playwright");
const { Keypair } = req("@solana/web3.js");
const demo = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(ROOT, ".demo-wallet.json"), "utf8"))));
const src = fs.readFileSync(path.join(ROOT, "scripts/record-demo.mjs"), "utf8");
let js = src.match(/const WALLET_JS = `([\s\S]*?)`;/)[1];
js = js
  .replace("${JSON.stringify(demo.publicKey.toBase58())}", JSON.stringify(demo.publicKey.toBase58()))
  .replace("${JSON.stringify(Buffer.from(demo.publicKey.toBytes()).toString(\"base64\"))}", JSON.stringify(Buffer.from(demo.publicKey.toBytes()).toString("base64")));

const b = await chromium.launch({ headless: true, channel: "chrome" });
const c = await b.newContext();
await c.exposeFunction("__dwSignTx", async () => "");
await c.exposeFunction("__dwSendTx", async () => "");
await c.exposeFunction("__dwSignMsg", async (b64) => {
  const { createPrivateKey, sign } = await import("node:crypto");
  const seed = demo.secretKey.slice(0, 32);
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
  return sign(null, Buffer.from(b64, "base64"), createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" })).toString("base64");
});
await c.addInitScript(js);
const p = await c.newPage();
p.on("console", (x) => console.log("[pg]", x.text().slice(0, 300)));
p.on("pageerror", (e) => console.log("[err]", String(e).slice(0, 300)));
await p.goto("https://stockcard-app.vercel.app/shop", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
console.log("pre:", JSON.stringify(await p.locator("button").allTextContents()));
await p.getByRole("button", { name: /Connect wallet/i }).first().click();
for (let i = 0; i < 8; i++) {
  await p.waitForTimeout(2000);
  const modal = await p.locator(".wallet-adapter-modal-wrapper, [class*='modal']").count();
  console.log(`t+${(i + 1) * 2}s modal=${modal} buttons=${JSON.stringify(await p.locator("button").allTextContents()).slice(0, 300)}`);
  await p.screenshot({ path: `/tmp/dbg-${i}.png` });
  const demo = p.getByRole("button", { name: /Demo Wallet/i });
  if (await demo.isVisible().catch(() => false)) {
    console.log("clicking Demo Wallet");
    await demo.click();
    break;
  }
}
await p.waitForTimeout(8000);
console.log("AFTER:", JSON.stringify(await p.locator("button").allTextContents()));
// now try claiming test money and watch what happens
p.on("response", (r) => { if (r.url().includes("/api/")) console.log(`[api ${r.status()}] ${r.url()}`); });
await p.waitForSelector('button:not([disabled]):has-text("Claim test money")', { timeout: 30000 }).catch(() => console.log("claim btn not enabled"));
await p.getByRole("button", { name: "Claim test money" }).click().catch((e) => console.log("claim click err", e.message.split("\n")[0]));
for (let i = 0; i < 15; i++) {
  await p.waitForTimeout(3000);
  const toasts = await p.locator('[role="status"]').allInnerTexts();
  if (toasts.length) console.log("TOASTS:", JSON.stringify(toasts));
}
await p.screenshot({ path: "/tmp/modal.png" });
await b.close();
