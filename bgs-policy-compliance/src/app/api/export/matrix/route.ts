import { exportMatrixCsv } from "@/lib/db/repository";

export async function GET() {
  const csv = await exportMatrixCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="responsibility-matrix.csv"',
    },
  });
}
