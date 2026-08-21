"use client";

import { Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { withBasePath } from "@/lib/paths";

export function UnlinkResponsibilityButton({
  linkId,
  label,
}: {
  linkId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onUnlink() {
    if (!confirm(`“${label}” холбоосыг салгах уу?`)) return;
    setPending(true);
    try {
      const res = await fetch(withBasePath(`/api/responsibilities/${linkId}`), {
        method: "DELETE",
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

  return (
    <button
      type="button"
      onClick={onUnlink}
      disabled={pending}
      title="Холбоосыг салгах"
      aria-label="Холбоосыг салгах"
      className="rounded border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
    >
      <Unlink size={14} />
    </button>
  );
}
