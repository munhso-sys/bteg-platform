"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  parseJobDragPayload,
  usePolicyJobDrag,
  type DropLinkTarget,
} from "@/components/policies/policy-job-drag-context";

/** Desktop-only drop target: drag a job position from the sticky tray onto this +. */
export function ClauseJobDropButton({
  target,
  title,
}: {
  target: DropLinkTarget;
  title: string;
}) {
  const drag = usePolicyJobDrag();
  const [over, setOver] = useState(false);

  if (!drag) return null;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={drag.dropBusy}
      onDragEnter={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const payload = parseJobDragPayload(e.dataTransfer);
        if (!payload.length) return;
        void drag.linkDrop(target, payload);
      }}
      className={cn(
        "hidden h-7 w-7 items-center justify-center rounded border lg:inline-flex",
        over || drag.dragging
          ? "border-orange-400 bg-orange-500/20 text-orange-800 dark:text-orange-100"
          : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)]",
        drag.dropBusy && "opacity-50",
      )}
    >
      <Plus size={14} />
    </button>
  );
}
