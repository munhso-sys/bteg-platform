"use client";

import { FileDown, FileType } from "lucide-react";
import { useState } from "react";
import { withBasePath } from "@/lib/paths";
import {
  clientDownloadFilename,
  parseContentDispositionFilename,
} from "@/lib/policy-document";
import type { PositionReviewScope } from "@/lib/position-review-document";
import { PositionsShareDialog } from "@/components/positions/positions-share-dialog";

function scopeQuery(
  scope: PositionReviewScope,
  positionId?: string | null,
): string {
  const params = new URLSearchParams();
  if (positionId) params.set("positionId", positionId);
  if (scope.organization) params.set("org", scope.organization);
  if (scope.heltesId) params.set("heltesId", scope.heltesId);
  if (scope.albaId) params.set("albaId", scope.albaId);
  if (scope.q?.trim()) params.set("q", scope.q.trim());
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function PositionsReviewToolbar({
  scope,
  positionId,
  downloadBaseName,
}: {
  scope: PositionReviewScope;
  /** When set, Word/PDF export the open preview screen for this position. */
  positionId?: string;
  downloadBaseName?: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<"word" | "pdf" | null>(null);
  const fileStem =
    downloadBaseName?.trim() ||
    (positionId ? "ajlyn-bair-shalgalt" : "ajlyn-bair-jagsaalt");

  async function download(kind: "word" | "pdf") {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch(
        withBasePath(
          `/api/positions/export/${kind}${scopeQuery(scope, positionId)}`,
        ),
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
        if (!w) throw new Error("Popup хаагдсан — зөвшөөрнө үү");
        w.document.open();
        w.document.write(html);
        w.document.close();
        window.setTimeout(() => {
          w.focus();
          w.print();
        }, 250);
        setMsg(
          positionId
            ? "PDF: хэвлэх цонхноос «Save as PDF» (A4, margin: зүүн 2.5см, дээр/доор 2см, баруун 1см)."
            : "PDF: хэвлэх цонхноос «Save as PDF» (A4 landscape, margin: зүүн 2.5см, дээр/доор 2см, баруун 1см).",
        );
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const filename = parseContentDispositionFilename(
          res.headers.get("Content-Disposition"),
          clientDownloadFilename(fileStem, "doc"),
        );
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
        title={
          positionId
            ? "Энэ дэлгэцийн мэдээллийг албан ёсны Word-оор татах"
            : "Шүүлттэй жагсаалтыг албан ёсны Word-оор татах"
        }
        className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs hover:bg-[var(--surface-muted)] disabled:opacity-50"
      >
        <FileType size={14} />
        {busy === "word" ? "…" : "Word"}
      </button>
      <button
        type="button"
        disabled={busy != null}
        onClick={() => void download("pdf")}
        title={
          positionId
            ? "Энэ дэлгэцийн мэдээллийг албан ёсны PDF-ээр хэвлэх"
            : "Шүүлттэй жагсаалтыг албан ёсны PDF-ээр хэвлэх"
        }
        className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs hover:bg-[var(--surface-muted)] disabled:opacity-50"
      >
        <FileDown size={14} />
        {busy === "pdf" ? "…" : "PDF"}
      </button>
      <PositionsShareDialog
        scope={scope}
        positionId={positionId}
        disabled={busy != null}
      />
      {msg ? (
        <span className="text-[11px] text-[var(--muted)]">{msg}</span>
      ) : null}
    </div>
  );
}
