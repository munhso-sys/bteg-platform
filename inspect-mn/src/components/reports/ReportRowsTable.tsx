"use client";

import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/components/ui/StatusBadge";
import type { ReportRow } from "@/lib/reports/types";
import {
  reportRowStatus,
  reportSeverityPriority,
} from "@/components/reports/reportLabels";

export function ReportRowsTable({
  id,
  rows,
  empty = "Мөр алга.",
}: {
  id: string;
  rows: ReportRow[];
  empty?: string;
}) {
  return (
    <div className="h-scroll soft-scroll overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
      <table id={id}>
        <thead>
          <tr>
            <th>Дохио</th>
            <th>Систем</th>
            <th>Зэрэг</th>
            <th>Үнэлгээ</th>
            <th>Төлөв</th>
            <th>Нэгж</th>
            <th>Огноо</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-sm text-[var(--muted)]">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={row.href} className="font-medium hover:underline">
                    {row.title}
                  </Link>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {row.owner}
                  </div>
                </td>
                <td className="whitespace-nowrap text-xs">{row.system}</td>
                <td>
                  <PriorityBadge priority={reportSeverityPriority(row.value)} />
                </td>
                <td className="tabular-nums font-semibold">{row.metric}</td>
                <td>
                  <StatusBadge status={reportRowStatus(row.status)} />
                </td>
                <td className="text-xs">{row.unit}</td>
                <td className="whitespace-nowrap tabular-nums text-xs">
                  {row.date}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
