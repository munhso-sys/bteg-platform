"use client";

import { GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { FloatingPanel } from "@/components/ui/floating-panel";

/**
 * Dedicated icon to view/edit Process / Location / Asset IDs (PFD keys).
 */
export function PfdLinkIdsMenu({
  positionName,
  linkIds,
  processId: initialProcessId = null,
  locationId: initialLocationId = null,
  assetId: initialAssetId = null,
}: {
  positionName: string;
  linkIds: string[];
  processId?: string | null;
  locationId?: string | null;
  assetId?: string | null;
}) {
  const router = useRouter();
  const menuId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [processId, setProcessId] = useState(initialProcessId ?? "");
  const [locationId, setLocationId] = useState(initialLocationId ?? "");
  const [assetId, setAssetId] = useState(initialAssetId ?? "");
  const [error, setError] = useState<string | null>(null);

  const ids = linkIds.filter(Boolean);
  const hasAny =
    !!(initialProcessId?.trim() ||
      initialLocationId?.trim() ||
      initialAssetId?.trim());

  useEffect(() => {
    setProcessId(initialProcessId ?? "");
    setLocationId(initialLocationId ?? "");
    setAssetId(initialAssetId ?? "");
  }, [initialProcessId, initialLocationId, initialAssetId]);

  async function save() {
    if (!ids.length) return;
    setPending(true);
    setError(null);
    try {
      const body = {
        process_id: processId.trim() || null,
        location_id: locationId.trim() || null,
        asset_id: assetId.trim() || null,
      };
      for (const linkId of ids) {
        const res = await fetch(
          withBasePath(`/api/responsibilities/${linkId}`),
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
          throw new Error(data?.error || `Алдаа (${res.status})`);
        }
      }
      router.refresh();
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
        title="Process / Location / Asset ID"
        aria-label={`${positionName} PFD ID`}
        disabled={pending || ids.length === 0}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded border text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)] disabled:opacity-50",
          open || hasAny
            ? "border-sky-400/60 bg-sky-500/15 text-sky-900 dark:text-sky-100"
            : "border-[var(--border)]",
        )}
      >
        <GitBranch size={14} />
      </button>

      <FloatingPanel
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        preferred="left"
        width={260}
        id={menuId}
        label="PFD холбоос ID"
      >
        <div className="mb-1.5 truncate text-[11px] font-medium text-[var(--fg)]">
          {positionName}
        </div>
        <p className="mb-2 text-[10px] text-[var(--muted)]">
          Process Flow Diagram-тай холбох түлхүүрүүд (job_process_id,
          job_location_id, job_asset_id).
        </p>
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
          Process ID
        </label>
        <input
          value={processId}
          disabled={pending}
          onChange={(e) => setProcessId(e.target.value)}
          className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 font-mono text-xs text-[var(--fg)]"
        />
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
          Location ID
        </label>
        <input
          value={locationId}
          disabled={pending}
          onChange={(e) => setLocationId(e.target.value)}
          className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 font-mono text-xs text-[var(--fg)]"
        />
        <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
          Asset ID
        </label>
        <input
          value={assetId}
          disabled={pending}
          onChange={(e) => setAssetId(e.target.value)}
          className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 font-mono text-xs text-[var(--fg)]"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="w-full rounded bg-[var(--fg)] px-2 py-1.5 text-xs text-[var(--card)] disabled:opacity-50"
        >
          Хадгалах
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
