"use client";

type Props = {
  contentUrl: string;
  fileName?: string;
};

/** Inline PDF via browser native viewer / object. */
export function PdfViewer({ contentUrl, fileName }: Props) {
  return (
    <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
        {fileName || "PDF"} ·{" "}
        <a
          href={contentUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--brand)] hover:underline"
        >
          Шинэ цонхонд нээх
        </a>
      </div>
      <iframe
        title={fileName || "pdf"}
        src={contentUrl}
        className="min-h-[520px] w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
