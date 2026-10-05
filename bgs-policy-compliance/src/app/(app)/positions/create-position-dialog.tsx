"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { OrgAssignTree } from "@/lib/org-assign";
import { CreatePositionForm } from "./create-position-form";

/** Icon next to position search — opens create dialog. */
export function CreatePositionDialog({ tree }: { tree: OrgAssignTree }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-start justify-center bg-slate-950/50 p-3 pt-[12vh] print:hidden sm:p-6 sm:pt-[10vh]"
            role="dialog"
            aria-modal="true"
            aria-label="Ажлын байр үүсгэх"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Ажлын байр үүсгэх
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Байгууллага · хэлтэс · алба холбож бүртгэнэ
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded border border-slate-200 p-1.5 hover:bg-slate-50"
                  aria-label="Хаах"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="max-h-[75vh] overflow-y-auto px-4 py-4">
                <CreatePositionForm
                  tree={tree}
                  onCreated={() => setOpen(false)}
                />
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
        onClick={() => setOpen(true)}
        title="Ажлын байр үүсгэх"
        aria-label="Ажлын байр үүсгэх"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700"
      >
        <Plus size={16} strokeWidth={2.25} />
      </button>
      {dialog}
    </>
  );
}
