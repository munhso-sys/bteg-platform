import { NextResponse } from "next/server";
import { resolveJobPositionRef } from "@/lib/access/resolve-position";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const name = searchParams.get("name");
  const resolved = await resolveJobPositionRef(id, name);
  if (!resolved) {
    return NextResponse.json(
      { ok: false, error: "Ажлын байр олдсонгүй" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, ...resolved });
}
