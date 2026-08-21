import { NextResponse } from "next/server";
import { policyRiskSignals } from "@/lib/risk/signals";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await policyRiskSignals();
    return NextResponse.json({
      ok: true,
      source: "policy",
      generatedAt: new Date().toISOString(),
      items,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Эрсдэлийн дохио уншигдсангүй",
        items: [],
      },
      { status: 500 },
    );
  }
}
