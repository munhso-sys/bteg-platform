export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[800px] space-y-4 px-4 py-5">
      <h1 className="text-xl font-semibold">Тохиргоо</h1>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--muted)]">
        <p>
          Одоогоор өгөгдөл <code className="text-xs">process/data/store.json</code>{" "}
          дээр хадгалагдана (бусад duty модультай адил local JSON pattern).
        </p>
        <p className="mt-2">
          Remote: ирээдүйд portal{" "}
          <code className="text-xs">app_data_store</code> түлхүүр{" "}
          <code className="text-xs">process_module_db</code> · SQL хүснэгт{" "}
          <code className="text-xs">process_nodes</code> migration бэлэн.
        </p>
        <p className="mt-2">
          Портал iframe: <code className="text-xs">http://localhost:3004</code> ·
          цэс «Процесс».
        </p>
      </div>
    </div>
  );
}
