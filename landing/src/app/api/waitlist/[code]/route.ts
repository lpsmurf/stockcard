import { NextResponse } from "next/server";
import { getWaitlistStatus } from "@/lib/waitlist";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const status = await getWaitlistStatus(code);
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(status);
}
