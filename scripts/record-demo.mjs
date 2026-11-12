#!/usr/bin/env node
/**
 * Records the StockCard demo (docs/demo-script.md) by driving the live app with an
 * injected wallet-standard "Demo Wallet" backed by a devnet keypair held by this
 * script. Each scene is its own browser context so every step lands as a separate
 * clip in docs/video/clips/NN-<name>.webm for narration afterwards.
 *
 * Prereqs:
 *   ./scripts/demo-price-loop.sh running in another terminal (fresh signed prices)
 *
 * Usage:
 *   node scripts/record-demo.mjs                 # all scenes
 *   node scripts/record-demo.mjs --only 02,05    # subset
 *   node scripts/record-demo.mjs --headed        # watch it happen
 *   node scripts/record-demo.mjs --base http://localhost:3000
 */
import { createRequire } from "node:module";
import { createPrivateKey, sign as cryptoSign } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(path.join(ROOT, "app", "package.json"));
const { chromium } = req("playwright");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} = req("@solana/web3.js");
const bs58 = req("bs58").default ?? req("bs58");

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const BASE = arg("--base") ?? "https://stockcard-app.vercel.app";
const ONLY = new Set((arg("--only") ?? "").split(",").filter(Boolean));
const HEADED = argv.includes("--headed");
const CLIPS = path.join(ROOT, "docs", "video", "clips");
fs.mkdirSync(CLIPS, { recursive: true });

// ---------- env + keys ----------
const ENV = new Map();
for (const line of fs.readFileSync(path.join(ROOT, "app", ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ENV.set(m[1], m[2].trim());
}
// Node-side RPC: prefer the public devnet endpoint so our sends don't compete with
// the app's heavily rate-limited Helius key. Override with RECORD_RPC if needed.
const RPC = process.env.RECORD_RPC ?? "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");

const WALLET_FILE = path.join(ROOT, ".demo-wallet.json");
let demo;
if (fs.existsSync(WALLET_FILE)) {
  demo = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_FILE, "utf8"))));
} else {
  demo = Keypair.generate();
  fs.writeFileSync(WALLET_FILE, JSON.stringify(Array.from(demo.secretKey)), { mode: 0o600 });
}
const admin = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(path.join(ROOT, ".devnet-wallet.json"), "utf8"))),
);

async function ensureFunds() {
  const bal = await connection.getBalance(demo.publicKey);
  if (bal < 0.04 * LAMPORTS_PER_SOL) {
    const sig = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        SystemProgram.transfer({ fromPubkey: admin.publicKey, toPubkey: demo.publicKey, lamports: 0.12 * LAMPORTS_PER_SOL }),
      ),
      [admin],
    );
    console.log(`funded demo wallet +0.12 SOL (${sig})`);
  }
  console.log(`demo wallet ${demo.publicKey.toBase58()}`);
}

// ---------- signing bridge (called from page via exposeFunction) ----------
// Bound per-keypair so the admin wallet can drive /admin while the demo wallet
// watches its position react on another page.
function signTxBytes(kp, buf) {
  try {
    const vt = VersionedTransaction.deserialize(buf);
    vt.sign([kp]);
    return Buffer.from(vt.serialize());
  } catch {
    const tx = Transaction.from(buf);
    tx.partialSign(kp);
    return tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  }
}
const signTxB64 = (kp) => (b64) => signTxBytes(kp, Buffer.from(b64, "base64")).toString("base64");
const sendTxB64 = (kp) => async (b64) => {
  const raw = signTxBytes(kp, Buffer.from(b64, "base64"));
  for (let attempt = 0; ; attempt++) {
    try {
      const sig = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 5 });
      await connection.confirmTransaction(sig, "confirmed");
      return Buffer.from(bs58.decode(sig)).toString("base64");
    } catch (e) {
      if (attempt >= 8 || !/429|rate|Too many/i.test(String(e?.message ?? e))) throw e;
      await sleep(Math.min(1500 * 2 ** attempt, 15000));
    }
  }
};
const signMsgB64 = (kp) => (b64) => {
  const seed = kp.secretKey.slice(0, 32);
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
  const key = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
  return cryptoSign(null, Buffer.from(b64, "base64"), key).toString("base64");
};

// ---------- injected wallet-standard wallet ----------
const walletJsFor = (kp) => `(() => {
  const CHAIN = "solana:devnet";
  const ADDRESS = ${JSON.stringify(kp.publicKey.toBase58())};
  const PUB_B64 = ${JSON.stringify(Buffer.from(kp.publicKey.toBytes()).toString("base64"))};
  window.__DW_ADDRESS = ADDRESS;
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const bytesToB64 = (bytes) => {
    let s = "";
    const b = new Uint8Array(bytes);
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  };
  const ICON = "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#b08d57"/><text x="16" y="21" font-size="13" text-anchor="middle" fill="#fff" font-family="sans-serif">SC</text></svg>');
  const listeners = {};
  const on = (event, listener) => { (listeners[event] = listeners[event] || new Set()).add(listener); return () => listeners[event].delete(listener); };
  const emit = (event, data) => { for (const l of listeners[event] || []) l(data); };
  const FEATURES = ["solana:signAndSendTransaction", "solana:signTransaction", "solana:signMessage"];
  const account = () => ({ address: ADDRESS, publicKey: b64ToBytes(PUB_B64), chains: [CHAIN], icon: ICON, label: "Demo account", features: FEATURES });
  const wallet = {
    version: "1.0.0",
    name: "Demo Wallet",
    icon: ICON,
    chains: [CHAIN],
    accounts: [],
    features: {
      "standard:connect": { version: "1.0.0", connect: async () => { wallet.accounts = [account()]; emit("change", { accounts: wallet.accounts }); return { accounts: wallet.accounts }; } },
      "standard:disconnect": { version: "1.0.0", disconnect: async () => { wallet.accounts = []; emit("change", { accounts: [] }); } },
      "standard:events": { version: "1.0.0", on },
      "solana:signTransaction": { version: "1.1.0", supportedTransactionVersions: ["legacy", 0],
        signTransaction: (...inputs) => Promise.all(inputs.map(async ({ transaction }) => ({ signedTransaction: b64ToBytes(await window.__dwSignTx(bytesToB64(transaction))) }))) },
      "solana:signAndSendTransaction": { version: "1.1.0", supportedTransactionVersions: ["legacy", 0],
        signAndSendTransaction: (...inputs) => Promise.all(inputs.map(async ({ transaction }) => ({ signature: b64ToBytes(await window.__dwSendTx(bytesToB64(transaction))) }))) },
      "solana:signMessage": { version: "1.0.0",
        signMessage: (...inputs) => Promise.all(inputs.map(async ({ message }) => ({ signedMessage: message, signature: b64ToBytes(await window.__dwSignMsg(bytesToB64(message))) }))) },
    },
  };
  const register = (api) => api.register(wallet);
  window.addEventListener("wallet-standard:app-ready", (event) => register(event.detail));
  window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
  // surface toasts to the playwright console for debugging (document exists; body may not yet)
  try {
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (!m.target.closest || !m.target.closest('[role="status"]')) continue;
        for (const n of m.addedNodes) if (n.nodeType === 1) console.log("[toast]", n.textContent);
      }
    }).observe(document, { childList: true, subtree: true });
  } catch {}
})();`;

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(p, ms = 2500) {
  await p.waitForTimeout(ms); // give narration room
}
async function waitConnected(p, timeout = 90000) {
  await p.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => /…/.test(b.textContent)),
    null,
    { timeout },
  );
  await p.waitForTimeout(1200);
}
async function connect(p, route = "/") {
  await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000); // hydration + first RPC round
  for (let i = 0; i < 3; i++) {
    const connected = await p
      .waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /…/.test(b.textContent)), null, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (connected) return;
    await p.getByRole("button", { name: /Connect wallet/i }).first().click();
    const picked = await p
      .getByRole("button", { name: /Demo Wallet/i })
      .click({ timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!picked) {
      // modal may not have opened (pre-hydration click) — dismiss and retry
      await p.keyboard.press("Escape");
      await p.waitForTimeout(1500);
    }
  }
  await waitConnected(p);
}
async function toastWith(p, re, timeout = 90000) {
  await p.getByText(re).first().waitFor({ timeout });
  await p.waitForTimeout(1500);
}
async function authFetch(p, route, body) {
  return p.evaluate(
    async ([route, body]) => {
      const ts = Date.now().toString();
      const msg = new TextEncoder().encode(`stockcard:${route}:${ts}`);
      const b64 = await window.__dwSignMsg(btoa(String.fromCharCode(...msg)));
      const res = await fetch(route, {
        method: "POST",
        headers: { "content-type": "application/json", "x-wallet": window.__DW_ADDRESS, "x-timestamp": ts, "x-signature": b64 },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    [route, body],
  );
}

// ---------- scenes ----------
const scenes = [
  ["01-home", "Home — tagline, prices chip, devnet badge", async (p) => {
    await connect(p);
    await shot(p, 5000);
    await p.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" }));
    await shot(p, 3000);
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await shot(p, 2000);
  }],

  ["02-shop", "Shop — claim test money, buy $50 NVDAx", async (p) => {
    await connect(p, "/shop");
    await p.waitForSelector('button:not([disabled]):has-text("Claim test money")');
    const claimRes = p.waitForResponse((r) => r.url().includes("/api/faucet"), { timeout: 60000 }).catch(() => null);
    await p.getByRole("button", { name: "Claim test money" }).click();
    const cr = await claimRes;
    console.log(`  faucet → ${cr?.status() ?? "no response"}`);
    await shot(p, 2500);
    const card = p.locator("div.rounded-2xl", { hasText: "NVIDIA" }).first();
    await card.locator('button:not([disabled]):has-text("Buy with test money")').waitFor();
    await card.getByRole("button", { name: "Buy with test money" }).click();
    await p.getByLabel("Amount").waitFor();
    await p.getByLabel("Amount").fill("50");
    await shot(p, 1500);
    const buyRes = p.waitForResponse((r) => r.url().includes("/api/shop/buy"), { timeout: 120000 });
    await p.getByRole("button", { name: "Buy", exact: true }).click();
    const br = await buyRes;
    console.log(`  shop/buy → ${br.status()}`);
    await p.getByLabel("Amount").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    await shot(p, 2000);
  }],

  ["03-borrow", "Borrow — deposit NVDAx, borrow dUSDC", async (p) => {
    await connect(p, "/portfolio/NVDAx?mode=deposit");
    await p.getByRole("button", { name: "Max" }).waitFor();
    await shot(p, 1500);
    await p.getByRole("button", { name: "Max" }).click();
    await shot(p, 1500);
    await p.waitForSelector('button:not([disabled]):has-text("Confirm and sign")');
    await p.getByRole("button", { name: "Confirm and sign" }).click();
    await p.waitForURL(/\/portfolio$/, { timeout: 120000 });
    await shot(p, 3000); // position now shows in assets
    await p.goto(`${BASE}/borrow`, { waitUntil: "domcontentloaded" });
    await shot(p, 2000);
    await p.getByRole("button", { name: "Max" }).waitFor();
    await p.getByRole("button", { name: "Max" }).click();
    await shot(p, 3500); // preview rows: New LTV, liquidation price, APR
    await p.waitForSelector('button:not([disabled]):has-text("Confirm and sign")');
    await p.getByRole("button", { name: "Confirm and sign" }).click();
    await p.waitForURL(`${BASE}/`, { timeout: 120000 });
    await shot(p, 2500); // home shows debt + credit line
  }],

  ["04-preipo", "Pre-IPO — buy T-OPENAI, asset detail, deposit, tighter bands", async (p) => {
    await connect(p, "/shop");
    await shot(p, 1000);
    const card = p.locator("div.rounded-2xl", { hasText: "OpenAI" }).first();
    await card.locator('button:not([disabled]):has-text("Buy with test money")').waitFor();
    await card.getByRole("button", { name: "Buy with test money" }).click();
    await p.getByLabel("Amount").waitFor();
    await p.getByLabel("Amount").fill("50");
    await shot(p, 1200);
    const buyRes = p.waitForResponse((r) => r.url().includes("/api/shop/buy"), { timeout: 120000 });
    await p.getByRole("button", { name: "Buy", exact: true }).click();
    console.log(`  shop/buy → ${(await buyRes).status()}`);
    await p.getByLabel("Amount").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    await shot(p, 1500);
    await p.goto(`${BASE}/portfolio/T-OPENAI`, { waitUntil: "domcontentloaded" });
    await shot(p, 4000); // Pre-IPO chip + NAV line + price sources
    await p.goto(`${BASE}/portfolio/T-OPENAI?mode=deposit`, { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: "Max" }).waitFor();
    await p.getByRole("button", { name: "Max" }).click();
    await shot(p, 1500);
    await p.waitForSelector('button:not([disabled]):has-text("Confirm and sign")');
    await p.getByRole("button", { name: "Confirm and sign" }).click();
    await p.waitForURL(/\/portfolio$/, { timeout: 120000 });
    await shot(p, 1500);
    await p.goto(`${BASE}/borrow?market=T-OPENAI`, { waitUntil: "domcontentloaded" });
    await shot(p, 4500); // tighter bands visible in sheet
  }],

  ["05-card", "Card — create, approve limit, coffee purchase", async (p) => {
    await connect(p, "/card");
    const create = p.getByRole("button", { name: "Create card" });
    if (await create.isVisible().catch(() => false)) {
      const cres = p.waitForResponse((r) => r.url().endsWith("/api/card") && r.request().method() === "POST", { timeout: 60000 });
      await create.click();
      console.log(`  card create → ${(await cres).status()}`);
      await shot(p, 2000);
    }
    await p.getByRole("button", { name: /Edit ›/ }).click();
    await p.getByLabel("Limit").waitFor();
    await p.getByLabel("Limit").fill("500");
    await shot(p, 1000);
    await p.getByRole("button", { name: "Approve limit" }).click();
    // approve is an on-chain SPL delegate; the sheet closes when the tx confirms
    await p.getByLabel("Limit").waitFor({ state: "detached", timeout: 120000 });
    await shot(p, 2500);
    await p.getByRole("link", { name: "Test purchase" }).click();
    await p.getByRole("button", { name: /Coffee \$4\.80/ }).waitFor();
    await p.getByRole("button", { name: /Coffee \$4\.80/ }).click();
    await shot(p, 1500);
    const simRes = p.waitForResponse((r) => r.url().includes("/api/card/simulate"), { timeout: 120000 });
    await p.getByRole("button", { name: "Pay", exact: true }).click();
    console.log(`  card/simulate → ${(await simRes).status()}`);
    await shot(p, 4000); // settled tx + queued cashback row in feed
  }],

  ["06-cashback", "Cashback — queued → deposited as collateral", async (p) => {
    await connect(p, "/card");
    await shot(p, 2500);
    await p.getByText(/cashback \(queued\)/).first().waitFor({ timeout: 60000 }).catch(() => {});
    await shot(p, 2000); // queued cashback row visible
    // trigger processing for the latest settled tx with queued cashback
    const done = await p.evaluate(async () => {
      const ts = Date.now().toString();
      const enc = new TextEncoder();
      const sign = async (route) => window.__dwSignMsg(btoa(String.fromCharCode(...enc.encode(`stockcard:${route}:${ts}`))));
      const headers = async (route) => ({ "content-type": "application/json", "x-wallet": window.__DW_ADDRESS, "x-timestamp": ts, "x-signature": await sign(route) });
      const list = await (await fetch("/api/card/transactions", { headers: await headers("/api/card/transactions") })).json();
      const tx = (list.data ?? []).find((t) => t.status === "settled" && t.cashback && t.cashback.status !== "sent" && t.cashback.status !== "failed");
      if (!tx) return null;
      return (await fetch("/api/cashback/process", { method: "POST", headers: await headers("/api/cashback/process"), body: JSON.stringify({ txId: tx.id }) })).json();
    });
    console.log("  cashback process:", JSON.stringify(done)?.slice(0, 200));
    await p.waitForTimeout(2000);
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByText(/cashback \(sent\)|cashback \(deposited\)/).first().waitFor({ timeout: 60000 }).catch(() => {});
    await shot(p, 3500); // row now shows deposited
  }],

  ["07-bank", "Bank — add IBAN, quote, simulated SEPA payout", async (p) => {
    await connect(p, "/bank");
    await shot(p, 1500);
    const addBtn = p.getByRole("button", { name: "+ Add" });
    await addBtn.click();
    await p.getByPlaceholder("Must match your name").fill("Luis Plönnig");
    await p.getByPlaceholder(/IBAN|DE44/i).fill("NL91ABNA0417164300");
    await shot(p, 1500); // "IBAN looks valid ✓"
    const saveRes = p.waitForResponse((r) => r.url().includes("/api/bank-accounts") && r.request().method() === "POST", { timeout: 60000 });
    await p.getByRole("button", { name: "Save account" }).click();
    console.log(`  bank-accounts → ${(await saveRes).status()}`);
    await p.getByPlaceholder("Must match your name").waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    await shot(p, 1500);
    await p.getByLabel("Amount").fill("50");
    await p.waitForResponse((r) => r.url().includes("/api/payouts/quote"), { timeout: 60000 }).catch(() => null);
    await shot(p, 2500); // quote appears ≈ USDC
    await p.waitForSelector('button:not([disabled]):has-text("Confirm and sign")');
    await p.getByRole("button", { name: "Confirm and sign" }).click();
    await p.getByText(/Sent on Solana|Processing|Arrived/i).first().waitFor({ timeout: 90000 });
    await shot(p, 2500);
    await p.getByText("Arrived", { exact: false }).first().waitFor({ timeout: 90000 }).catch(() => {});
    await shot(p, 2500);
  }],

  ["08-portfolio-admin", "Portfolio + admin crash −30% → alert banner", async (p) => {
    await connect(p, "/portfolio");
    await shot(p, 4000);
    await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await shot(p, 2000);
    const crash = p.getByRole("button", { name: /Crash −30%|Crash/ }).first();
    await crash.click();
    await shot(p, 5000); // banner / liquidation state appears
    const restore = p.getByRole("button", { name: /Restore/ }).first();
    if (await restore.isVisible().catch(() => false)) await restore.click();
    await shot(p, 3000);
  }],
];

// ---------- runner ----------
async function main() {
  await ensureFunds();
  const browser = await chromium.launch({ headless: !HEADED, channel: "chrome" });
  const picked = scenes.filter(([id]) => !ONLY.size || [...ONLY].some((o) => id.startsWith(o)));
  console.log(`recording ${picked.length} scene(s) against ${BASE} → ${CLIPS}`);
  // One context for the whole run: wallet stays connected across scene pages via
  // wallet-adapter autoConnect (localStorage), and each page gets its own .webm clip.
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    recordVideo: { dir: CLIPS, size: { width: 1280, height: 800 } },
  });
  await ctx.exposeFunction("__dwSignTx", signTxB64);
  await ctx.exposeFunction("__dwSendTx", sendTxB64);
  await ctx.exposeFunction("__dwSignMsg", signMsgB64);
  await ctx.addInitScript(WALLET_JS);
  for (const [id, name, fn] of picked) {
    console.log(`\n▶ ${id} ${name}`);
    const page = await ctx.newPage();
    page.setDefaultTimeout(90000);
    page.on("console", (m) => {
      const t = m.text();
      if (!/429|MWA|Failed to load resource|Download the React DevTools/i.test(t)) console.log("  [pg]", t.slice(0, 200));
    });
    page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 300)));
    page.on("response", (r) => {
      if (r.url().includes("/api/")) console.log(`  [api ${r.status()}] ${r.url().replace(BASE, "")} (${r.request().timing()?.responseEnd?.toFixed(0) ?? "?"}ms)`);
    });
    const t0 = Date.now();
    try {
      await fn(page);
      console.log(`  done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e) {
      console.log(`  FAILED: ${e.message?.split("\n")[0]}`);
      await page.screenshot({ path: path.join(CLIPS, `${id}-error.png`) }).catch(() => {});
    }
    const video = page.video();
    await page.close();
    if (video) {
      const vp = await video.path();
      fs.renameSync(vp, path.join(CLIPS, `${id}.webm`));
    }
  }
  await ctx.close();
  await browser.close();
  console.log("\nclips:");
  for (const f of fs.readdirSync(CLIPS).filter((f) => f.endsWith(".webm"))) console.log(`  ${CLIPS}/${f}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
