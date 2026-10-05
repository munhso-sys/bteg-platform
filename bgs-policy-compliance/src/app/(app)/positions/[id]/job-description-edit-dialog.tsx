"use client";

import { Pencil, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  mergeParsedIntoDraft,
  type ParsedJobDescriptionFields,
} from "@/lib/job-description/parse-core";
import { withBasePath } from "@/lib/paths";
import type { JobDescription } from "@/lib/types";
import { JobDescriptionForm } from "./job-description-form";

export function JobDescriptionEditDialog({
  positionId,
  initial,
}: {
  positionId: string;
  initial: Partial<JobDescription> | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<Partial<JobDescription> | null>(initial);
  const [formKey, setFormKey] = useState(0);
  const [parsePending, setParsePending] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseMsg, setParseMsg] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !parsePending) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, parsePending]);

  function openDialog() {
    setDraft(initial);
    setFormKey((k) => k + 1);
    setParseError(null);
    setParseMsg(null);
    setWarnings([]);
    setOpen(true);
  }

  async function onParseUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setParseError("Эхлээд файл сонгоно уу.");
      return;
    }
    setParsePending(true);
    setParseError(null);
    setParseMsg(null);
    setWarnings([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(withBasePath("/api/job-descriptions/parse"), {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        fields?: ParsedJobDescriptionFields;
        warnings?: string[];
        fileName?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.fields) {
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      const merged = mergeParsedIntoDraft(
        draft as Record<string, unknown> | null,
        data.fields,
      );
      setDraft(merged);
      setFormKey((k) => k + 1);
      setWarnings(data.warnings ?? []);
      setParseMsg(
        `«${data.fileName ?? file.name}» файлаас талбаруудыг формд орууллаа.`,
      );
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Задалж чадсангүй");
    } finally {
      setParsePending(false);
    }
  }

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 p-3 print:hidden sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="АБТ засварлах"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !parsePending) setOpen(false);
            }}
          >
            <div
              className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Ажлын байрны тодорхойлолт (АБТ) засварлах
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Загвар.docx бүтэц · А–E хэсэг · хүснэгтийн мөр нэмэх/хасах
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded border border-slate-200 p-1.5 hover:bg-slate-50"
                  aria-label="Хаах"
                  disabled={parsePending}
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                <JobDescriptionForm
                  key={formKey}
                  positionId={positionId}
                  initial={draft}
                  onSaved={() => setOpen(false)}
                />

                <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-slate-600" aria-hidden />
                    <h3 className="text-sm font-semibold text-slate-800">
                      Ажлын байрны журам / АБТ файл
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    PDF, DOCX, MD, TXT, JSON upload хийгээд дээрх формыг
                    автоматаар бөглөнө.
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx,.md,.txt,.json,application/pdf,application/json,text/plain,text/markdown"
                    className="block w-full text-xs text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                    disabled={parsePending}
                  />
                  <button
                    type="button"
                    onClick={onParseUpload}
                    disabled={parsePending}
                    className="w-full rounded border border-slate-400 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {parsePending
                      ? "Задаж байна…"
                      : "Файл задалж формд оруулах"}
                  </button>
                  {parseError ? (
                    <p className="text-xs text-rose-700">{parseError}</p>
                  ) : null}
                  {parseMsg ? (
                    <p className="text-xs text-emerald-700">{parseMsg}</p>
                  ) : null}
                  {warnings.length > 0 ? (
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                      {warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        АБТ засварлах
      </button>
      {dialog}
    </>
  );
}
