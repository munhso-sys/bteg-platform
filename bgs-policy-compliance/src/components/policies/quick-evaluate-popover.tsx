"use client";

import { ArrowLeft, ChevronDown, ChevronRight, Star } from "lucide-react";
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
import { ScoreChip } from "@/components/ui/primitives";

const STATUSES = Object.keys(COMPLIANCE_STATUS_LABELS) as ComplianceStatus[];

export type EvalRolePage = {
  type: ResponsibilityType;
  clauseIds: string[];
  defaultScore?: number | null;
  processId?: string | null;
  locationId?: string | null;
  assetId?: string | null;
  comment?: string | null;
  evidence?: string | null;
  excludeFromAverage?: boolean;
  /** Concrete position UUID for this role (may differ after name-merge). */
  jobPositionId?: string;
};

type PanelView = { kind: "list" } | { kind: "eval"; type: ResponsibilityType };

/**
 * ★ menu: evaluate / edit metrics for already-linked role types only.
 * New role types are added via ⋮ — this dropdown only switches among linked ones.
 */
export function QuickEvaluatePopover({
  positionName,
  jobPositionId,
  roles,
  initialType,
}: {
  positionName: string;
  jobPositionId: string;
  roles: EvalRolePage[];
  /** Open directly on this role when provided (e.g. from a type row). */
  initialType?: ResponsibilityType;
}) {
  const router = useRouter();
  const menuId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>({ kind: "list" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [type, setType] = useState<ResponsibilityType>(
    initialType ?? roles[0]?.type ?? "IMPLEMENTATION",
  );
  const [period, setPeriod] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [score, setScore] = useState(50);
  const [status, setStatus] = useState<ComplianceStatus>("partially_compliant");
  const [comment, setComment] = useState("");
  const [evidence, setEvidence] = useState("");
  const [exclude, setExclude] = useState(false);
  const [processId, setProcessId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [pfdOpen, setPfdOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const active = roles.find((r) => r.type === type) ?? roles[0] ?? null;
  const activePositionId = active?.jobPositionId ?? jobPositionId;
  const activeClauseIds = active?.clauseIds ?? [];

  useEffect(() => {
    if (!open) {
      setView({ kind: "list" });
      setError(null);
      setOkMsg(null);
      setInfoOpen(false);
      setPfdOpen(false);
      return;
    }
    if (initialType && roles.some((r) => r.type === initialType)) {
      setView({ kind: "eval", type: initialType });
      loadRole(initialType);
    } else {
      setView({ kind: "list" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/initial only
  }, [open, initialType]);

  function loadRole(next: ResponsibilityType) {
    const role = roles.find((r) => r.type === next);
    if (!role) return;
    setType(next);
    setScore(
      role.defaultScore != null && Number.isFinite(role.defaultScore)
        ? role.defaultScore
        : 50,
    );
    setProcessId(role.processId ?? "");
    setLocationId(role.locationId ?? "");
    setAssetId(role.assetId ?? "");
    setComment(role.comment ?? "");
    setEvidence(role.evidence ?? "");
    setExclude(role.excludeFromAverage === true);
    setPfdOpen(false);
    setInfoOpen(false);
    setOkMsg(null);
    setError(null);
  }

  function openEval(next: ResponsibilityType) {
    loadRole(next);
    setView({ kind: "eval", type: next });
  }

  async function save() {
    if (!activeClauseIds.length) {
      setError("Зүйл олдсонгүй");
      return;
    }
    if (exclude && !comment.trim()) {
      setInfoOpen(true);
      setError("Дундажаас хасах үед тайлбар заавал шаардлагатай");
      return;
    }
    setPending(true);
    setError(null);
    setOkMsg(null);
    try {
      // Persist PFD IDs for this role if edited.
      const linkRes = await fetch(withBasePath("/api/responsibilities"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          activeClauseIds.length === 1
            ? {
                policy_clause_id: activeClauseIds[0],
                job_position_id: activePositionId,
                responsibility_type: type,
                process_id: processId.trim() || null,
                location_id: locationId.trim() || null,
                asset_id: assetId.trim() || null,
              }
            : {
                items: activeClauseIds.map((policy_clause_id) => ({
                  policy_clause_id,
                  job_position_id: activePositionId,
                  responsibility_type: type,
                  process_id: processId.trim() || null,
                  location_id: locationId.trim() || null,
                  asset_id: assetId.trim() || null,
                })),
              },
        ),
      });
      if (!linkRes.ok) {
        const data = (await linkRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `PFD ID хадгалж чадсангүй (${linkRes.status})`);
      }

      const res = await fetch(withBasePath("/api/evaluations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_clause_ids: activeClauseIds,
          job_position_ids: [activePositionId],
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
        activeClauseIds.length > 1
          ? `${data?.count ?? activeClauseIds.length} зүйлд хадгаллаа.`
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
        disabled={pending || roles.length === 0}
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
        width={320}
        id={menuId}
        label="Үнэлгээ өгөх"
      >
        {view.kind === "list" ? (
          <>
            <div className="mb-1.5 truncate text-[11px] font-medium text-[var(--fg)]">
              {positionName}
            </div>
            <p className="mb-2 text-[10px] text-[var(--muted)]">
              Үүрэг сонгоод үнэлгээ өгнө. Төрөл солих / нэмэх — ⋮ цэснээс.
            </p>
            <ul className="space-y-1">
              {roles.map((r) => (
                <li key={r.type}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => openEval(r.type)}
                    className="flex w-full items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-left hover:border-orange-400/50 disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-[var(--fg)]">
                        {RESPONSIBILITY_LABELS[r.type]}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-[var(--muted)]">
                        {[r.processId, r.locationId, r.assetId]
                          .filter(Boolean)
                          .join(" · ") || "ID оруулаагүй"}
                      </span>
                    </span>
                    <ScoreChip score={r.defaultScore ?? null} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {view.kind === "eval" && active ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => setView({ kind: "list" })}
              className="mb-2 inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--fg)]"
            >
              <ArrowLeft size={12} />
              Үүргийн жагсаалт
            </button>

            <div className="mb-2 rounded border border-[var(--border)]/70 bg-[var(--surface-muted)]/50 px-2 py-1.5 text-[11px]">
              <div>
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Ажлын байр
                </span>
                <div className="truncate font-medium text-[var(--fg)]">
                  {positionName}
                </div>
              </div>
              <div className="mt-1">
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Үүрэг
                </span>
                <div className="truncate font-medium text-[var(--fg)]">
                  {RESPONSIBILITY_LABELS[type]}
                </div>
              </div>
            </div>

            <div className="mb-2 rounded border border-[var(--border)]/70 bg-[var(--surface-muted)]/50">
              <button
                type="button"
                disabled={pending}
                aria-expanded={pfdOpen}
                onClick={() => setPfdOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[10px] uppercase tracking-wide text-[var(--muted)] hover:text-[var(--fg)]"
              >
                {pfdOpen ? (
                  <ChevronDown size={12} className="shrink-0" />
                ) : (
                  <ChevronRight size={12} className="shrink-0" />
                )}
                <span className="flex-1">PFD ID (энэ үүрэг)</span>
                {!pfdOpen ? (
                  <span className="max-w-[9rem] truncate font-mono normal-case tracking-normal text-[10px]">
                    {[processId, locationId, assetId]
                      .filter((v) => v.trim())
                      .join(" · ") || "—"}
                  </span>
                ) : null}
              </button>
              {pfdOpen ? (
                <div className="border-t border-[var(--border)]/60 px-2 pb-1.5 pt-1">
                  <label className="mb-0.5 block text-[10px] text-[var(--muted)]">
                    Process ID
                  </label>
                  <input
                    value={processId}
                    disabled={pending}
                    onChange={(e) => setProcessId(e.target.value)}
                    className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-mono text-xs text-[var(--fg)]"
                  />
                  <label className="mb-0.5 block text-[10px] text-[var(--muted)]">
                    Location ID
                  </label>
                  <input
                    value={locationId}
                    disabled={pending}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-mono text-xs text-[var(--fg)]"
                  />
                  <label className="mb-0.5 block text-[10px] text-[var(--muted)]">
                    Asset ID
                  </label>
                  <input
                    value={assetId}
                    disabled={pending}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="mb-0.5 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-mono text-xs text-[var(--fg)]"
                  />
                </div>
              ) : null}
            </div>

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

            <div className="mb-2 rounded border border-[var(--border)]/70 bg-[var(--surface-muted)]/50">
              <button
                type="button"
                disabled={pending}
                aria-expanded={infoOpen}
                onClick={() => setInfoOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[10px] uppercase tracking-wide text-[var(--muted)] hover:text-[var(--fg)]"
              >
                {infoOpen ? (
                  <ChevronDown size={12} className="shrink-0" />
                ) : (
                  <ChevronRight size={12} className="shrink-0" />
                )}
                <span className="flex-1">Мэдээлэл</span>
                {!infoOpen ? (
                  <span className="max-w-[10rem] truncate normal-case tracking-normal text-[10px]">
                    {[
                      COMPLIANCE_STATUS_LABELS[status],
                      comment.trim() || null,
                      exclude ? "дундажаас хассан" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                ) : null}
              </button>
              {infoOpen ? (
                <div className="border-t border-[var(--border)]/60 px-2 pb-1.5 pt-1.5">
                  <select
                    className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--fg)]"
                    value={status}
                    disabled={pending}
                    onChange={(e) =>
                      setStatus(e.target.value as ComplianceStatus)
                    }
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
                    className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--fg)]"
                    placeholder="Тайлбар"
                  />
                  <textarea
                    rows={2}
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    disabled={pending}
                    className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs text-[var(--fg)]"
                    placeholder="Нотлох баримт (үнэлгээ)"
                  />

                  <label className="flex items-start gap-1.5 text-[11px] text-[var(--fg)]">
                    <input
                      type="checkbox"
                      checked={exclude}
                      disabled={pending}
                      onChange={(e) => setExclude(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Дундажаас хасах
                      <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                        {positionName} · {RESPONSIBILITY_LABELS[type]}
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              disabled={pending}
              onClick={() => void save()}
              className="w-full rounded bg-orange-500 px-2 py-1.5 text-xs text-white disabled:opacity-50"
            >
              Үнэлгээ хадгалах
            </button>
          </>
        ) : null}

        {error ? (
          <p className="mt-1.5 text-[11px] text-rose-700 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        {okMsg ? (
          <p className="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
            {okMsg}
          </p>
        ) : null}
      </FloatingPanel>
    </div>
  );
}
