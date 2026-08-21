import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-white px-6 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Inbox size={18} />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      {description ? (
        <p className="max-w-sm text-xs text-[var(--muted)]">{description}</p>
      ) : null}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="animate-pulse space-y-3 rounded-md border border-[var(--border)] bg-white p-4">
      <div className="h-4 w-1/3 rounded bg-slate-200" />
      <div className="h-3 w-full rounded bg-slate-100" />
      <div className="h-3 w-5/6 rounded bg-slate-100" />
      <div className="h-3 w-2/3 rounded bg-slate-100" />
    </div>
  );
}
