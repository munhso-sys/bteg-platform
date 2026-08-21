import Link from "next/link";

export function OrgBreadcrumb({
  items,
}: {
  items: Array<{ href?: string; label: string }>;
}) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-600">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <span className="text-slate-400">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-900">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function ChoiceCard({
  href,
  title,
  description,
  count,
}: {
  href: string;
  title: string;
  description: string;
  count?: number | string;
}) {
  return (
    <Link
      href={href}
      className="block rounded border border-slate-300 bg-white p-4 transition hover:border-slate-500 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{title}</div>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {count != null ? (
          <div className="rounded bg-slate-900 px-2 py-1 font-mono text-sm text-white">
            {count}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
