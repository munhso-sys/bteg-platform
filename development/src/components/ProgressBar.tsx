export function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 w-full rounded bg-slate-200">
      <div
        className="h-2 rounded bg-[var(--brand)]"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
