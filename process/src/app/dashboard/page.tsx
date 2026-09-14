import Link from "next/link";
import { getDb, getTree } from "@/lib/store";
import { computeAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [db, tree] = await Promise.all([getDb(), getTree()]);
  const roots = tree;
  const rootAnalytics = roots.map((r) => ({
    node: r,
    analytics: computeAnalytics(db, r.id),
  }));

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-5">
      <div>
        <h1 className="text-xl font-semibold">Процесс самбар</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Модулуудын нэгдсэн суурь — {db.nodes.length} зангилаа · seed demo
          өгөгдөлтэй
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Зангилаа" value={String(db.nodes.length)} />
        <Kpi label="RACI холбоос" value={String(db.raci_links.length)} />
        <Kpi label="Зөрчил" value={String(db.issue_links.length)} />
        <Kpi
          label="Дуу хоолой"
          value={String(db.employee_report_links.length)}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            L1 макро процессууд
          </h2>
          <Link
            href="/processes"
            className="text-sm font-medium text-[var(--brand)] hover:underline"
          >
            Процессын зураг →
          </Link>
        </div>
        <ul className="space-y-2">
          {rootAnalytics.map(({ node, analytics }) => (
            <li
              key={node.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{node.title}</div>
                  <div className="font-mono text-xs text-[var(--muted)]">
                    {node.code}
                  </div>
                </div>
                {analytics ? (
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge>
                      Биелэлт {analytics.procedure_compliance_rate}%
                    </Badge>
                    <Badge>Зөрчил {analytics.open_issues_count}</Badge>
                    <Badge>Эрсдэл {analytics.risk_level}</Badge>
                    <Badge>Health {analytics.health}</Badge>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--fg)]">Модуль холболт</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Журмын биелэлт —{" "}
            <code className="text-xs">process_id</code> on responsibilities
          </li>
          <li>
            Хяналт шалгалт — checklist / finding{" "}
            <code className="text-xs">process_id</code>
          </li>
          <li>
            Эрсдэл, ажилтны дуу хоолой — portal signals linked by{" "}
            <code className="text-xs">process_id</code>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--background)] px-2 py-1 font-medium text-[var(--fg)]">
      {children}
    </span>
  );
}
