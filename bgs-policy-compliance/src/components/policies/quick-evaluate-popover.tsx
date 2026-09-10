"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  COMPLIANCE_STATUS_LABELS,
  RESPONSIBILITY_LABELS,
} from "@/lib/constants";
import { withBasePath } from "@/lib/paths";
import type { ComplianceStatus, ResponsibilityType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FloatingPanel } from "@/components/ui/floating-panel";

const STATUSES = Object.keys(COMPLIANCE_STATUS_LABELS) as ComplianceStatus[];

export function QuickEvaluatePopover({
  positionName,
  jobPositionId,
  clauseIds,
  responsibilityType,
  responsibilityTypes,
  defaultScore,
}: {
  positionName: string;
  jobPositionId: string;
  clauseIds: string[];
  responsibilityType: ResponsibilityType;
  responsibilityTypes?: ResponsibilityType[];
  defaultScore?: number | null;
}) {
  const router = useRouter();
  const menuId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [type, setType] = useState(responsibilityType);
  const [period, setPeriod] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [score, setScore] = useState(
    defaultScore != null && Number.isFinite(defaultScore) ? defaultScore : 50,
  );
  const [status, setStatus] = useState<ComplianceStatus>("partially_compliant");
  const [comment, setComment] = useState("");
  const [evidence, setEvidence] = useState("");
  const [exclude, setExclude] = useState(false);

  const types =
    responsibilityTypes && responsibilityTypes.length > 0
      ? responsibilityTypes
      : [responsibilityType];

  useEffect(() => {
    setType(responsibilityType);
  }, [responsibilityType]);

  async function save() {
    if (!clauseIds.length) {
      setError("Зүйл олдсонгүй");
      return;
    }
    if (exclude && !comment.trim()) {
      setError("Дундажаас хасах үед тайлбар заавал шаардлагатай");
      return;
    }
    setPending(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(withBasePath("/api/evaluations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_clause_ids: clauseIds,
          job_position_ids: [jobPositionId],
          responsibility_type: type,
          evaluation_period: period,
          score: Number(score),
          status,
          comment: comment.trim() || null,
          evidence_text: evidence.trim() || null,
          exclude_from_average: exclude,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      const data = (await res.json().catch(() => null)) as {
        count?: number;
      } | null;
      setOkMsg(
        clauseIds.length > 1
          ? `${data?.count ?? clauseIds.length} зүйлд хадгаллаа.`
          : "Хадгаллаа.",
      );
      router.refresh();
      window.setTimeout(() => setOpen(false), 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        title="Үнэлгээ өгөх"
        aria-label={`${positionName} үнэлгээ өгөх`}
        disabled={pending || clauseIds.length === 0}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded border text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)] disabled:opacity-50",
          open
            ? "border-orange-400/60 bg-orange-500/15 text-orange-700 dark:text-orange-200"
            : "border-[var(--border)]",
        )}
      >
        <Star size={14} />
      </button>

      <FloatingPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        preferred="left"
        width={300}
        id={menuId}
        label="Үнэлгээ өгөх"
      >
        <div className="mb-1.5 truncate text-[11px] font-medium text-[var(--fg)]">
          {positionName}
        </div>
        {clauseIds.length > 1 ? (
          <p className="mb-1.5 text-[10px] text-[var(--muted)]">
            Энэ хүрээний {clauseIds.length} зүйлд оноо орно
          </p>
        ) : null}

        <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
          Үүргийн төрөл
        </label>
        <select
          className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
          value={type}
          disabled={pending}
          onChange={(e) => setType(e.target.value as ResponsibilityType)}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {RESPONSIBILITY_LABELS[t]}
            </option>
          ))}
        </select>

        <div className="mb-1.5 grid grid-cols-2 gap-1.5">
          <input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            disabled={pending}
            className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
            placeholder="YYYY-MM"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            disabled={pending}
            className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
          />
        </div>

        <select
          className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
          value={status}
          disabled={pending}
          onChange={(e) => setStatus(e.target.value as ComplianceStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {COMPLIANCE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={pending}
          className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
          placeholder="Тайлбар"
        />
        <textarea
          rows={2}
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          disabled={pending}
          className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
          placeholder="Нотлох баримт"
        />

        <label className="mb-2 flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-1.5 text-[10px] text-amber-950 dark:text-amber-100">
          <input
            type="checkbox"
            checked={exclude}
            onChange={(e) => setExclude(e.target.checked)}
            disabled={pending}
            className="mt-0.5"
          />
          <span>Дундажаас хасах / Анхаарах</span>
        </label>

        {error ? (
          <p className="mb-1.5 text-[11px] text-rose-700 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        {okMsg ? (
          <p className="mb-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
            {okMsg}
          </p>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="w-full rounded bg-orange-500 px-2 py-1.5 text-xs text-white disabled:opacity-50"
        >
          {pending ? "Хадгалж байна…" : "Хадгалах"}
        </button>
      </FloatingPanel>
    </div>
  );
}
