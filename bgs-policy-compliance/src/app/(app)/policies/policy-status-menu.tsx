"use client";

import { ArrowRightLeft, X } from "lucide-react";
import { useState } from "react";
import {
  POLICY_STATUS_LABELS,
  POLICY_STATUS_TRANSITIONS,
} from "@/lib/constants";
import { withBasePath } from "@/lib/paths";
import type { PolicyStatus } from "@/lib/types";

export function PolicyStatusMenu({
  policyId,
  policyName,
  currentStatus,
  onChanged,
}: {
  policyId: string;
  policyName: string;
  currentStatus: PolicyStatus;
  onChanged: (next: PolicyStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = POLICY_STATUS_TRANSITIONS[currentStatus] ?? [];

  async function choose(next: PolicyStatus) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/policies/${policyId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      onChanged(next);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Төлөв солиж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        title="Төлөв солих"
        aria-label="Төлөв солих"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded border border-[var(--border)] p-1.5 text-[var(--muted)] hover:border-[var(--brand)] hover:bg-[var(--surface-muted)] hover:text-[var(--brand)]"
      >
        <ArrowRightLeft size={14} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-status-title"
            className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <h3
                  id="policy-status-title"
                  className="text-sm font-semibold text-[var(--fg)]"
                >
                  Төлөв солих
                </h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {policyName}
                  <span className="mx-1">·</span>
                  Одоо: {POLICY_STATUS_LABELS[currentStatus]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)]"
                aria-label="Хаах"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2 p-4">
              {options.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={pending}
                  onClick={() => void choose(status)}
                  className="flex w-full items-center justify-between rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-left text-sm text-[var(--fg)] hover:border-[var(--brand)] hover:bg-[var(--surface-muted)] focus-visible:border-[var(--brand)] focus-visible:bg-[var(--surface-muted)] focus-visible:outline-none disabled:opacity-50"
                >
                  <span className="font-medium text-[var(--fg)]">
                    {POLICY_STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {status === "active"
                      ? "Идэвхтэй хүснэгт"
                      : status === "draft"
                        ? "Ноорог хүснэгт"
                        : "Архив хүснэгт"}
                  </span>
                </button>
              ))}
              {error ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
              ) : null}
              {pending ? (
                <p className="text-xs text-[var(--muted)]">Хадгалж байна…</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
