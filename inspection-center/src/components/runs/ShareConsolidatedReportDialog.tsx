"use client";

import { useMemo, useState } from "react";
import { Share2, X } from "lucide-react";
import type { ConsolidatedReport } from "@/lib/runs/consolidated-report";

type Channel = "email" | "telegram";
type Format = "word" | "pdf";

export function ShareConsolidatedReportDialog({
  disabled,
  report,
  runTitle,
  inspectionDate,
  inspectedByOrg,
  performers,
  inspectionType,
  filename,
}: {
  disabled?: boolean;
  report: ConsolidatedReport;
  runTitle: string;
  inspectionDate: string;
  inspectedByOrg?: string;
  performers?: Array<{ name: string; position: string }>;
  inspectionType?: "JOINT_INSPECTION" | "NIGHT_INSPECTION";
  filename?: string;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("email");
  const [formats, setFormats] = useState<Format[]>(["word", "pdf"]);
  const [recipientsText, setRecipientsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recipients = useMemo(() => {
    return [
      ...new Set(
        recipientsText
          .split(/[\n,;]+/)
          .map((part) => part.trim())
          .filter(Boolean),
      ),
    ];
  }, [recipientsText]);

  function toggleFormat(format: Format) {
    setFormats((prev) => {
      if (prev.includes(format)) {
        return prev.filter((f) => f !== format);
      }
      return [...prev, format];
    });
  }

  async function onSubmit() {
    setMessage(null);
    setError(null);

    if (!formats.length) {
      setError("Word эсвэл PDF сонгоно уу.");
      return;
    }
    if (!recipients.length) {
      setError(
        channel === "email"
          ? "Имэйл хаяг оруулна уу."
          : "Telegram chat ID оруулна уу.",
      );
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/runs/share-consolidated-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          formats,
          recipients,
          report,
          runTitle,
          inspectionDate,
          inspectedByOrg,
          performers,
          inspectionType,
          filename,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        results?: Array<{ recipient: string; ok: boolean; error?: string }>;
      };

      if (!res.ok || !data.ok) {
        const detail =
          data.results
            ?.filter((r) => !r.ok)
            .map((r) => `${r.recipient}: ${r.error || "алдаа"}`)
            .join("; ") || data.error;
        setError(detail || `Илгээхэд алдаа (${res.status})`);
        return;
      }

      const okCount = data.results?.filter((r) => r.ok).length ?? recipients.length;
      setMessage(`Амжилттай илгээлээ (${okCount}).`);
      setRecipientsText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сүлжээний алдаа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          setMessage(null);
          setError(null);
        }}
        title="Үл тохирлын тайланг имэйл / Telegram-аар хуваалцах"
      >
        <Share2 size={16} />
        Хуваалцах
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Үл тохирлын тайлан хуваалцах"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-md border border-[var(--border)] bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Тайлан хуваалцах</div>
                <div className="text-xs text-[var(--muted)]">
                  Word / PDF-ийг имэйл эсвэл Telegram-аар илгээнэ
                </div>
              </div>
              <button
                type="button"
                className="btn shrink-0 p-1.5"
                aria-label="Хаах"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <fieldset className="mb-3 space-y-2">
              <legend className="mb-1 text-xs font-semibold">Суваг</legend>
              <label className="mr-4 inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="share-channel"
                  checked={channel === "email"}
                  onChange={() => setChannel("email")}
                  disabled={busy}
                />
                Email
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="share-channel"
                  checked={channel === "telegram"}
                  onChange={() => setChannel("telegram")}
                  disabled={busy}
                />
                Telegram
              </label>
            </fieldset>

            <fieldset className="mb-3 space-y-2">
              <legend className="mb-1 text-xs font-semibold">Формат</legend>
              <label className="mr-4 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formats.includes("word")}
                  onChange={() => toggleFormat("word")}
                  disabled={busy}
                />
                Word (.doc)
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formats.includes("pdf")}
                  onChange={() => toggleFormat("pdf")}
                  disabled={busy}
                />
                PDF
              </label>
            </fieldset>

            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-xs font-semibold">
                {channel === "email"
                  ? "Имэйл хаягууд"
                  : "Telegram chat ID-ууд"}
              </span>
              <textarea
                className="min-h-24 w-full rounded border border-[var(--border)] px-2 py-1.5 text-sm"
                placeholder={
                  channel === "email"
                    ? "name@example.com, other@example.com"
                    : "123456789\n-1001234567890"
                }
                value={recipientsText}
                onChange={(event) => setRecipientsText(event.target.value)}
                disabled={busy}
              />
              <span className="mt-1 block text-[11px] text-[var(--muted)]">
                Таслал эсвэл шинэ мөрөөр тусгаарлана.
              </span>
            </label>

            {error ? (
              <p className="mb-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="mb-2 text-sm text-emerald-700" role="status">
                {message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Болих
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || disabled}
                onClick={() => void onSubmit()}
              >
                {busy ? "Илгээж байна…" : "Илгээх"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
