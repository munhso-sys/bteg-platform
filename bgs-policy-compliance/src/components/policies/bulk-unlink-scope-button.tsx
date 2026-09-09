"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Unlink } from "lucide-react";
import { withBasePath } from "@/lib/paths";

export function BulkUnlinkScopeButton({
  label,
  confirmLabel,
  policyId,
  sectionId,
  clauseId,
  linkIds,
  variant = "button",
}: {
  label: string;
  confirmLabel?: string;
  policyId?: string;
  sectionId?: string;
  clauseId?: string;
  linkIds?: string[];
  variant?: "button" | "icon";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onUnlink() {
    const title = confirmLabel ?? label;
    if (
      !confirm(
        `“${title}” хамрах хүрээний бүх холбоосыг салгах уу? Холбоотой үнэлгээнүүд мөн устана.`,
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const body =
        linkIds && linkIds.length
          ? { ids: linkIds }
          : {
              ...(policyId ? { policy_id: policyId } : {}),
              ...(sectionId ? { section_id: sectionId } : {}),
              ...(clauseId ? { clause_id: clauseId } : {}),
            };
      const res = await fetch(withBasePath("/api/responsibilities/bulk-unlink"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let message = `Алдаа (${res.status})`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        alert(message);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onUnlink}
        disabled={pending}
        title={label}
        aria-label={label}
        className="shrink-0 rounded border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
      >
        <Unlink size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onUnlink}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800 hover:bg-rose-100 disabled:opacity-50"
    >
      <Unlink size={14} />
      {label}
    </button>
  );
}
