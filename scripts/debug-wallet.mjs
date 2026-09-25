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
await c.exposeFunction("__dwSignMsg", async () => "");
await c.addInitScript(js);
const p = await c.newPage();
p.on("console", (x) => console.log("[pg]", x.text().slice(0, 300)));
p.on("pageerror", (e) => console.log("[err]", String(e).slice(0, 300)));
await p.goto("https://stockcard-app.vercel.app/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
await p.getByRole("button", { name: /Connect wallet/i }).first().click();
await p.waitForTimeout(3000);
console.log("MODAL BUTTONS:", JSON.stringify(await p.locator("button").allTextContents()));
await p.getByRole("button", { name: /Demo Wallet/i }).click();
await p.waitForTimeout(5000);
console.log("AFTER:", JSON.stringify(await p.locator("button").allTextContents()));
await p.screenshot({ path: "/tmp/modal.png" });
await b.close();
