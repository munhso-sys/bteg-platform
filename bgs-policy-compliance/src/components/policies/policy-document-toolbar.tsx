"use client";

import { FileDown, FileType } from "lucide-react";
import { useState } from "react";
import { withBasePath } from "@/lib/paths";
import { clientDownloadFilename } from "@/lib/policy-document";
import { PolicyShareDialog } from "@/components/policies/policy-share-dialog";

export function PolicyDocumentToolbar({
  policyId,
  policyName,
}: {
  policyId: string;
  policyName: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"word" | "pdf" | null>(null);

  async function download(kind: "word" | "pdf") {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch(
        withBasePath(`/api/policies/${policyId}/export/${kind}`),
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      if (kind === "pdf") {
        const html = await res.text();
        const w = window.open("", "_blank");
        if (!w) {
          throw new Error("Popup хаагдсан — зөвшөөрнө үү");
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
        window.setTimeout(() => {
          w.focus();
          w.print();
        }, 250);
        setMsg(
          "PDF: хэвлэх цонхноос «Save as PDF» сонгоно уу (margin: зүүн 2.5см, дээр/доор 2см, баруун 1см).",
        );
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const filename = clientDownloadFilename(policyName || "policy", "doc");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setMsg(`Word файл татагдлаа: ${filename}`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Татаж чадсангүй");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={busy != null}
        onClick={() => void download("word")}
        title="Word татах (албан ёсны формат)"
        className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--fg)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
      >
        <FileType size={14} />
        {busy === "word" ? "…" : "Word"}
      </button>
      <button
        type="button"
        disabled={busy != null}
        onClick={() => void download("pdf")}
        title="PDF (хэвлэх / Save as PDF)"
        className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--fg)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
      >
        <FileDown size={14} />
        {busy === "pdf" ? "…" : "PDF"}
      </button>
      <PolicyShareDialog
        policyId={policyId}
        policyName={policyName}
        disabled={busy != null}
      />
      {msg ? (
        <span className="text-[11px] text-[var(--muted)]">{msg}</span>
      ) : null}
    </div>
  );
}
