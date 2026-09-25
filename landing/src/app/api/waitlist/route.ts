import { NextResponse } from "next/server";
import { addToWaitlist, type WaitlistInput } from "@/lib/waitlist";

export async function POST(request: Request) {
  let body: Partial<WaitlistInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const result = await addToWaitlist(
    {
      email: String(body.email ?? ""),
      assetToLock: String(body.assetToLock ?? ""),
      cashbackAsset: String(body.cashbackAsset ?? ""),
      wallet: body.wallet ? String(body.wallet) : undefined,
      ref: body.ref ? String(body.ref) : undefined,
    },
    ip
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
