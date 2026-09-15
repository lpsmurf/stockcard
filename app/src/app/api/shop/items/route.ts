import { ok } from "@/lib/api";
import items from "@/lib/shop-items.json";

export const dynamic = "force-dynamic";

/** GET /api/shop/items — stocks (client reads the signed price on-chain), TIDE, mirrored items.
 *  Includes the shop treasury address (public; it's where payments visibly go on-chain). */
export async function GET() {
  return ok({ items, treasury: process.env.SHOP_TREASURY_ADDRESS ?? "" });
}

