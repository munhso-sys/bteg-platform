"use client";

import { MoreVertical, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { RESPONSIBILITY_LABELS } from "@/lib/constants";
import { withBasePath } from "@/lib/paths";
import type { ResponsibilityType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FloatingPanel } from "@/components/ui/floating-panel";

const TYPES = Object.keys(RESPONSIBILITY_LABELS) as ResponsibilityType[];

export function EditResponsibilityLinkMenu({
  linkIds,
  positionName,
  responsibilityType,
}: {
  linkIds: string[];
  positionName: string;
  responsibilityType: ResponsibilityType;
}) {
  const router = useRouter();
  const menuId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [type, setType] = useState(responsibilityType);
  const [error, setError] = useState<string | null>(null);

  const ids = linkIds.filter(Boolean);

  useEffect(() => {
    setType(responsibilityType);
  }, [responsibilityType]);

  async function saveType(next: ResponsibilityType) {
    if (next === responsibilityType || ids.length === 0) return;
    setPending(true);
    setError(null);
    try {
      for (const linkId of ids) {
        const res = await fetch(withBasePath(`/api/responsibilities/${linkId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responsibility_type: next }),
        });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (!res.ok) {
          setError(data?.error || `Алдаа (${res.status})`);
          setType(responsibilityType);
          return;
        }
      }
      setType(next);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function unlink() {
    if (ids.length === 0) return;
    const countLabel = ids.length > 1 ? ` (${ids.length} холбоос)` : "";
    if (!confirm(`“${positionName}” холбоосыг салгах уу?${countLabel}`)) return;
    setPending(true);
    setError(null);
    try {
      const res =
        ids.length === 1
          ? await fetch(withBasePath(`/api/responsibilities/${ids[0]}`), {
              method: "DELETE",
            })
          : await fetch(withBasePath("/api/responsibilities/bulk-unlink"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids }),
            });
      if (!res.ok) {
        let message = `Алдаа (${res.status})`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        setError(message);
        return;
      }
      setOpen(false);
      router.refresh();
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
        title="Холбоос засах"
        aria-label={`${positionName} холбоос засах`}
        disabled={pending || ids.length === 0}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded border text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)] disabled:opacity-50",
          open
            ? "border-orange-400/60 bg-orange-500/15 text-orange-700 dark:text-orange-200"
            : "border-[var(--border)]",
        )}
      >
        <MoreVertical size={14} />
      </button>

      <FloatingPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        preferred="left"
        width={240}
        id={menuId}
        label="Холбоос засах"
      >
        <div className="mb-1.5 truncate text-[11px] font-medium text-[var(--fg)]">
          {positionName}
        </div>
        {ids.length > 1 ? (
          <p className="mb-1.5 text-[10px] text-[var(--muted)]">
            Энэ хүрээнд {ids.length} холбоос — өөрчлөлт бүгдэд хэрэгжинэ
          </p>
        ) : null}
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
          Үүргийн төрөл
        </label>
        <select
          className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
          value={type}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as ResponsibilityType;
            setType(next);
            void saveType(next);
          }}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {RESPONSIBILITY_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={() => void unlink()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-800 hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-200"
        >
          <Unlink size={12} />
          Холбоос салгах
        </button>
        {error ? (
          <p className="mt-1.5 text-[11px] text-rose-700 dark:text-rose-300">
            {error}
          </p>
        ) : null}
      </FloatingPanel>
    </div>
  );
}
