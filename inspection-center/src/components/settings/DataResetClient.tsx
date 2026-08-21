"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { StoreClearSection } from "@/lib/store";

const SECTIONS: Array<{
  id: StoreClearSection;
  label: string;
  hint: string;
  defaultChecked?: boolean;
}> = [
  {
    id: "execution",
    label: "Шалгалтын гүйцэтгэл ба үр дүн",
    hint: "Гүйцэтгэл (runs), хариулт, оноо, зөрчил, арга хэмжээ, нотлох баримт",
    defaultChecked: true,
  },
  {
    id: "legacyPlans",
    label: "Хуучин төлөвлөгөө (plans)",
    hint: "Store дахь InspectionPlan бүртгэл — самбарын «төлөвлөгөө» тоонд нөлөөлнө",
  },
  {
    id: "annualPlans",
    label: "Жилийн төлөвлөгөө — Хуудсаар",
    hint: "Хуудсаар нэмсэн жилийн төлөвлөгөөний мөрүүд",
  },
  {
    id: "annualPlanTypes",
    label: "Жилийн төлөвлөгөө — Төрлөөр",
    hint: "Төрлөөр оруулсан жилийн тоо, сарын сонголт",
  },
];

const CONFIRM_WORD = "УСТГАХ";

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

type ExportResult =
  | { ok: true; filename: string; json: string }
  | { ok: false; error: string };

function selectedSections(selected: Record<StoreClearSection, boolean>) {
  return (Object.keys(selected) as StoreClearSection[]).filter(
    (id) => selected[id],
  );
}

function downloadJsonFile(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DataResetClient({
  clearAction,
  exportAction,
  counts,
}: {
  clearAction: (formData: FormData) => Promise<ActionResult>;
  exportAction: (formData: FormData) => Promise<ExportResult>;
  counts: {
    execution: number;
    legacyPlans: number;
    annualPlans: number;
    annualPlanTypes: number;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Record<StoreClearSection, boolean>>({
    execution: true,
    legacyPlans: false,
    annualPlans: false,
    annualPlanTypes: false,
  });
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);

  const anySelected = Object.values(selected).some(Boolean);
  const confirmOk = confirm.trim() === CONFIRM_WORD;
  const busy = pending || exporting;

  function toggle(id: StoreClearSection) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    setDownloaded(false);
  }

  async function onExport() {
    setMessage("");
    setError("");
    if (!anySelected) return;
    setExporting(true);
    try {
      const formData = new FormData();
      for (const id of selectedSections(selected)) {
        formData.append("section", id);
      }
      const result = await exportAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      downloadJsonFile(result.filename, result.json);
      setDownloaded(true);
      setMessage(`DATA татлаа: ${result.filename}`);
    } finally {
      setExporting(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!anySelected || !confirmOk) return;

    const formData = new FormData();
    for (const id of selectedSections(selected)) {
      formData.append("section", id);
    }
    formData.set("confirm", confirm.trim());

    startTransition(async () => {
      const result = await clearAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      setConfirm("");
      setDownloaded(false);
      startTransition(() => router.refresh());
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-100">
        Устгахаас өмнө сонгосон DATA-г JSON файлаар татаж авна уу. Template /
        master хуудас, эрсдэлийн босго, алба·хуудас холболт хадгалагдана. Зөвхөн
        Admin.
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-[var(--fg)]">
          Хэсэг сонгох (тах / устгах)
        </legend>
        {SECTIONS.map((section) => (
          <label
            key={section.id}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2.5"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={selected[section.id]}
              onChange={() => toggle(section.id)}
              disabled={busy}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--fg)]">
                {section.label}
                <span className="ml-2 tabular-nums text-[var(--muted)]">
                  ({counts[section.id]})
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {section.hint}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn"
          disabled={busy || !anySelected}
          onClick={() => void onExport()}
        >
          {exporting ? "Татаж байна…" : "Сонгосон DATA татах"}
        </button>
        {downloaded ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            Татсан · устгах боломжтой
          </span>
        ) : (
          <span className="text-xs text-[var(--muted)]">
            Устгахаас өмнө DATA татахыг зөвлөж байна
          </span>
        )}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-[var(--fg)]">
          Баталгаажуулах · <span className="font-mono">{CONFIRM_WORD}</span> гэж
          бичнэ үү
        </span>
        <input
          className="input max-w-xs"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={busy}
          autoComplete="off"
          placeholder={CONFIRM_WORD}
        />
      </label>

      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || !anySelected || !confirmOk}
      >
        {pending ? "Устгаж байна…" : "Сонгосон өгөгдлийг устгах"}
      </button>
    </form>
  );
}
