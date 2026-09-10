"use client";

import { AlertTriangle, MessageSquareText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { FloatingPanel } from "@/components/ui/floating-panel";

export function AttentionNoteMarker({
  evaluationId,
  comment,
  evidence,
  compact,
  readOnly,
  variant = "exclude",
}: {
  evaluationId?: string | null;
  comment?: string | null;
  evidence?: string | null;
  compact?: boolean;
  readOnly?: boolean;
  /** exclude = дундажаас хассан; note = дундажид орсон тайлбар/баримт */
  variant?: "exclude" | "note";
}) {
  const router = useRouter();
  const panelId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState(comment ?? "");
  const [draftEvidence, setDraftEvidence] = useState(evidence ?? "");
  const [draftExclude, setDraftExclude] = useState(variant === "exclude");

  const isExclude = variant === "exclude";

  useEffect(() => {
    setDraftComment(comment ?? "");
    setDraftEvidence(evidence ?? "");
    setDraftExclude(variant === "exclude");
  }, [comment, evidence, variant]);

  async function patch(body: {
    comment?: string | null;
    evidence_text?: string | null;
    exclude_from_average?: boolean;
  }) {
    if (!evaluationId) return false;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        withBasePath(`/api/evaluations/${evaluationId}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error || `Алдаа (${res.status})`);
        return false;
      }
      setEditing(false);
      setOpen(false);
      router.refresh();
      return true;
    } finally {
      setPending(false);
    }
  }

  async function save() {
    const nextComment = draftComment.trim();
    if (draftExclude && !nextComment) {
      setError("Дундажаас хасах үед тайлбар заавал шаардлагатай");
      return;
    }
    if (!draftExclude && !nextComment && !draftEvidence.trim()) {
      setError("Тайлбар эсвэл нотлох баримт оруулна уу (эсвэл тэмдэглэгээ арилгана уу)");
      return;
    }
    await patch({
      comment: nextComment || null,
      evidence_text: draftEvidence.trim() || null,
      exclude_from_average: draftExclude,
    });
  }

  /** Keep score in average; keep comment as normal note if present. */
  async function disableExcludeFlag() {
    if (
      !confirm(
        "«Дундажаас хассан» тэмдэгтийг идэвхгүй болгох уу? Оноо дундажид орно.",
      )
    ) {
      return;
    }
    await patch({
      exclude_from_average: false,
      comment: comment ?? null,
      evidence_text: evidence ?? null,
    });
  }

  /** Remove marker entirely (clear flag + comment/evidence). Score remains. */
  async function clearMarker() {
    if (
      !confirm(
        isExclude
          ? "Анхаарах тэмдэглэгээ болон тайлбар/баримтыг арилгах уу? Үнэлгээний оноо үлдэнэ, дундажид орно."
          : "Тайлбар/баримтын тэмдэглэгээг арилгах уу? Үнэлгээний оноо үлдэнэ.",
      )
    ) {
      return;
    }
    await patch({
      exclude_from_average: false,
      comment: null,
      evidence_text: null,
    });
  }

  return (
    <div className="relative inline-flex shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        title={
          isExclude
            ? "Дундажаас хассан · анхаарах"
            : "Тайлбар/баримт · дундажид орно"
        }
        aria-label={isExclude ? "Анхаарах тэмдэглэгээ" : "Тайлбар тэмдэглэгээ"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded border",
          compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
          isExclude
            ? "border-amber-500/50 bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 dark:text-amber-100"
            : "border-sky-500/50 bg-sky-500/15 text-sky-900 hover:bg-sky-500/25 dark:text-sky-100",
        )}
      >
        {isExclude ? (
          <AlertTriangle size={compact ? 11 : 12} />
        ) : (
          <MessageSquareText size={compact ? 11 : 12} />
        )}
        {compact ? (isExclude ? "!" : "i") : isExclude ? "Анхаарах" : "Тайлбар"}
      </button>

      <FloatingPanel
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(false);
          setError(null);
        }}
        anchorRef={btnRef}
        preferred="left"
        width={300}
        id={panelId}
        label={isExclude ? "Анхаарах тэмдэглэгээ" : "Тайлбар тэмдэглэгээ"}
        className={isExclude ? "border-amber-500/40" : "border-sky-500/40"}
      >
        <div
          className={cn(
            "mb-1.5 text-[11px] font-semibold uppercase tracking-wide",
            isExclude
              ? "text-amber-800 dark:text-amber-200"
              : "text-sky-800 dark:text-sky-200",
          )}
        >
          {isExclude
            ? "Дундажаас хассан · анхаарах"
            : "Тайлбар / баримт · дундажид орно"}
        </div>

        {editing && evaluationId && !readOnly ? (
          <div className="space-y-1.5">
            <textarea
              rows={3}
              value={draftComment}
              onChange={(e) => setDraftComment(e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
              placeholder="Тайлбар / өөрчлөлт"
            />
            <textarea
              rows={2}
              value={draftEvidence}
              onChange={(e) => setDraftEvidence(e.target.value)}
              className="w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
              placeholder="Нотлох баримт"
            />
            <label className="flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-1.5 text-[10px] text-amber-950 dark:text-amber-100">
              <input
                type="checkbox"
                checked={draftExclude}
                onChange={(e) => setDraftExclude(e.target.checked)}
                disabled={pending}
                className="mt-0.5"
              />
              <span>Дундажаас хасах / Анхаарах</span>
            </label>
            {error ? (
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => void save()}
                className={cn(
                  "rounded px-2 py-1 text-[11px] text-white disabled:opacity-50",
                  draftExclude ? "bg-amber-600" : "bg-sky-600",
                )}
              >
                {pending ? "…" : "Хадгалах"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setDraftComment(comment ?? "");
                  setDraftEvidence(evidence ?? "");
                  setDraftExclude(variant === "exclude");
                  setError(null);
                }}
                className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg)]"
              >
                Болих
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 text-xs text-[var(--fg)]">
            <div>
              <div className="text-[10px] uppercase text-[var(--muted)]">
                Тайлбар
              </div>
              <p className="whitespace-pre-wrap">{comment?.trim() || "—"}</p>
            </div>
            {evidence?.trim() ? (
              <div>
                <div className="text-[10px] uppercase text-[var(--muted)]">
                  Нотлох баримт
                </div>
                <p className="whitespace-pre-wrap">{evidence}</p>
              </div>
            ) : null}
            {error ? (
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                {error}
              </p>
            ) : null}
            {evaluationId && !readOnly ? (
              <div className="flex flex-col gap-1.5 pt-0.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setEditing(true);
                    setError(null);
                  }}
                  className={cn(
                    "rounded border px-2 py-1.5 text-[11px]",
                    isExclude
                      ? "border-amber-500/40 text-amber-900 hover:bg-amber-500/15 dark:text-amber-100"
                      : "border-sky-500/40 text-sky-900 hover:bg-sky-500/15 dark:text-sky-100",
                  )}
                >
                  Өөрчлөлт хийх
                </button>
                {isExclude ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void disableExcludeFlag()}
                    className="rounded border border-[var(--border)] px-2 py-1.5 text-[11px] text-[var(--fg)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
                  >
                    Тэмдэгтийг идэвхгүй болгох
                    <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                      Оноо дундажид орно (тайлбар үлдэнэ)
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void clearMarker()}
                  className="inline-flex items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-800 hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-200"
                >
                  <Trash2 size={12} />
                  Тэмдэглэгээ арилгах
                </button>
              </div>
            ) : null}
          </div>
        )}
      </FloatingPanel>
    </div>
  );
}
