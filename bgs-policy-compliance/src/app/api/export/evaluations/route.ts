import { exportEvaluationsCsv } from "@/lib/db/repository";

export async function GET() {
  const csv = await exportEvaluationsCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="evaluations.csv"',
    },
  });
}
