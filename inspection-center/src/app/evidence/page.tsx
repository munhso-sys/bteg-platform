import { PageHeader } from "@/components/layout/PageHeader";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { StatusBadge, TableScroll } from "@/components/ui/primitives";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

function isDataUrl(url: string) {
  return url.startsWith("data:");
}

function evidenceFileLabel(fileUrl: string, caption: string, fileType: string) {
  // Caption often ends with " · filename.ext" from joint scoring photo upload
  const fromCaption = caption.split(" · ").at(-1)?.trim();
  if (fromCaption && /\.[a-z0-9]{2,5}$/i.test(fromCaption)) {
    return fromCaption;
  }
  if (isDataUrl(fileUrl)) {
    const mime = fileUrl.slice(5).split(";")[0] || fileType || "file";
    return mime.startsWith("image/") ? "Зураг (хавсралт)" : "Файл (хавсралт)";
  }
  try {
    const path = fileUrl.split("?")[0] ?? fileUrl;
    const name = path.split("/").filter(Boolean).at(-1);
    if (name) return decodeURIComponent(name);
  } catch {
    // ignore
  }
  return fileUrl.slice(0, 48) || "Файл";
}

export default function EvidencePage() {
  const data = readStore();
  const evidence = [...data.evidence].sort((a, b) =>
    b.uploadedAt.localeCompare(a.uploadedAt),
  );

  return (
    <div>
      <PageHeader
        title="Нотлох баримт"
        subtitle="Шалгалт / зөрчил / арга хэмжээний хавсралтууд"
        actions={<ExportButtons tableId="evidence-table" filename="evidence" />}
      />
      <TableScroll size="md" maxHeightClass="max-h-[36rem]">
        <table id="evidence-table">
          <thead>
            <tr>
              <th className="col-text-secondary">Тайлбар</th>
              <th className="col-text-primary">Файл</th>
              <th className="col-narrow">Төрөл</th>
              <th className="col-narrow">Холбоос</th>
              <th className="col-narrow">Оруулсан</th>
            </tr>
          </thead>
          <tbody>
            {evidence.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-sm text-[var(--muted)]">
                  Нотлох баримт байхгүй.
                </td>
              </tr>
            ) : (
              evidence.map((e) => {
                const label = evidenceFileLabel(e.fileUrl, e.caption, e.fileType);
                const dataUrl = isDataUrl(e.fileUrl);
                return (
                  <tr key={e.id}>
                    <td className="col-text-secondary" title={e.caption}>
                      <span className="cell-ellipsis font-medium">{e.caption}</span>
                    </td>
                    <td className="col-text-primary">
                      <div className="flex min-w-0 items-center gap-2">
                        {dataUrl && e.fileType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={e.fileUrl}
                            alt={label}
                            className="h-10 w-10 shrink-0 rounded border border-[var(--border)] object-cover"
                          />
                        ) : null}
                        <a
                          href={e.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="cell-ellipsis text-sm font-medium text-[var(--brand-dark)] hover:underline"
                          title={label}
                        >
                          {label}
                        </a>
                      </div>
                    </td>
                    <td className="col-narrow">
                      <StatusBadge>{e.fileType}</StatusBadge>
                    </td>
                    <td className="col-narrow text-xs text-[var(--muted)]">
                      {[
                        e.answerId ? "хариулт" : null,
                        e.findingId ? "зөрчил" : null,
                        e.actionId ? "арга хэмжээ" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "гүйцэтгэл"}
                    </td>
                    <td className="col-narrow text-sm" title={e.uploadedBy}>
                      <span className="cell-ellipsis">{e.uploadedBy}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableScroll>
      {evidence.some((e) => e.runId) ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Зурагтай мөрүүдийг нээж харна. Эх сурвалж: хамтарсан шалгалтын оноо өгөх үед
          оруулсан нотлох зураг.
        </p>
      ) : null}
    </div>
  );
}
