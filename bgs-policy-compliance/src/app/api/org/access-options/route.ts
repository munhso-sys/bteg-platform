import { NextResponse } from "next/server";
import { getAccessOptions } from "@/lib/db/org";

export async function GET() {
  try {
    const data = await getAccessOptions();
    return NextResponse.json(
      { ok: true, ...data },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Org options failed",
      },
      { status: 500 },
    );
  }
}
