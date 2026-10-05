"use client";

import { ArrowLeft, MoreVertical, Plus, Trash2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { RESPONSIBILITY_LABELS } from "@/lib/constants";
import { withBasePath } from "@/lib/paths";
import type { ResponsibilityType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FloatingPanel } from "@/components/ui/floating-panel";

const TYPES = Object.keys(RESPONSIBILITY_LABELS) as ResponsibilityType[];

export type LinkedRoleRow = {
  linkId: string;
  type: ResponsibilityType;
  processId?: string | null;
  locationId?: string | null;
  assetId?: string | null;
};

type PanelView =
  | { kind: "list" }
  | { kind: "add" }
  | { kind: "edit"; linkId: string };

/**
 * ⋮ menu: add / change / remove RACI roles. Each role has its own
 * Process/Location/Asset IDs via a sub-panel.
 */
export function EditResponsibilityLinkMenu({
  positionName,
  jobPositionId,
  clauseIds,
  roles,
}: {
  positionName: string;
  jobPositionId: string;
  clauseIds: string[];
  roles: LinkedRoleRow[];
}) {
  const router = useRouter();
  const menuId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>({ kind: "list" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addType, setAddType] = useState<ResponsibilityType>("MONITORING");
  const [editType, setEditType] = useState<ResponsibilityType>("IMPLEMENTATION");
  const [processId, setProcessId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [assetId, setAssetId] = useState("");

  const existingTypes = useMemo(
    () => new Set(roles.map((r) => r.type)),
    [roles],
  );
  const addableTypes = TYPES.filter((t) => !existingTypes.has(t));

  const editingRole =
    view.kind === "edit"
      ? roles.find((r) => r.linkId === view.linkId) ?? null
      : null;

  /** Current type + types not already linked on this position. */
  const editableTypes = useMemo(() => {
    if (!editingRole) return TYPES;
    return TYPES.filter(
      (t) => t === editingRole.type || !existingTypes.has(t),
    );
  }, [editingRole, existingTypes]);

  useEffect(() => {
    if (!open) {
      setView({ kind: "list" });
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (addableTypes.length && !addableTypes.includes(addType)) {
      setAddType(addableTypes[0]!);
    }
  }, [addableTypes, addType]);

  useEffect(() => {
    if (view.kind === "add") {
      setProcessId("");
      setLocationId("");
      setAssetId("");
      setError(null);
    } else if (view.kind === "edit" && editingRole) {
      setEditType(editingRole.type);
      setProcessId(editingRole.processId ?? "");
      setLocationId(editingRole.locationId ?? "");
      setAssetId(editingRole.assetId ?? "");
      setError(null);
    }
  }, [view, editingRole]);

  function openAdd() {
    if (!addableTypes.length) return;
    setAddType(addableTypes[0]!);
    setView({ kind: "add" });
  }

  function openEdit(linkId: string) {
    setView({ kind: "edit", linkId });
  }

  async function addRole() {
    if (!clauseIds.length || !addableTypes.includes(addType)) return;
    setPending(true);
    setError(null);
    try {
      const items = clauseIds.map((policy_clause_id) => ({
        policy_clause_id,
        job_position_id: jobPositionId,
        responsibility_type: addType,
        process_id: processId.trim() || null,
        location_id: locationId.trim() || null,
        asset_id: assetId.trim() || null,
      }));
      const res = await fetch(withBasePath("/api/responsibilities"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items.length === 1 ? items[0] : { items }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error || `Алдаа (${res.status})`);
      setView({ kind: "list" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нэмж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  async function saveEdit() {
    if (!editingRole) return;
    if (!editableTypes.includes(editType)) {
      setError("Энэ үүргийн төрөл аль хэдийн холбогдсон");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const body: {
        process_id: string | null;
        location_id: string | null;
        asset_id: string | null;
        responsibility_type?: ResponsibilityType;
      } = {
        process_id: processId.trim() || null,
        location_id: locationId.trim() || null,
        asset_id: assetId.trim() || null,
      };
      if (editType !== editingRole.type) {
        body.responsibility_type = editType;
      }
      const res = await fetch(
        withBasePath(`/api/responsibilities/${editingRole.linkId}`),
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
      setView({ kind: "list" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  async function removeRole(linkId: string, type: ResponsibilityType) {
    if (
      !confirm(`“${RESPONSIBILITY_LABELS[type]}” үүргийн төрлийг арилгах уу?`)
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/responsibilities/${linkId}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      setView({ kind: "list" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Арилгаж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  async function unlinkAll() {
    if (!roles.length) return;
    if (
      !confirm(
        `“${positionName}” бүх үүргийн холбоосыг салгах уу? (${roles.length})`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const ids = roles.map((r) => r.linkId);
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
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Салгаж чадсангүй");
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
        title="Үүрэг нэмэх / засах"
        aria-label={`${positionName} үүрэг засах`}
        disabled={pending}
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
        width={300}
        id={menuId}
        label="Үүрэг / PFD ID"
      >
        {view.kind === "list" ? (
          <>
            <div className="mb-1.5 truncate text-[11px] font-medium text-[var(--fg)]">
              {positionName}
            </div>
            <p className="mb-2 text-[10px] text-[var(--muted)]">
              Үүрэг сонгоод төрөл болон Process / Location / Asset ID засна.
              Шинэ төрөл «Нэмэх»-ээр орно.
            </p>
            <ul className="mb-2 space-y-1">
              {roles.length === 0 ? (
                <li className="text-[11px] text-[var(--muted)]">
                  Үүрэг байхгүй — доорх «Нэмэх»-ээр эхлүүлнэ.
                </li>
              ) : (
                roles.map((r) => (
                  <li key={r.linkId}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openEdit(r.linkId)}
                      className="flex w-full items-center justify-between gap-1 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-left text-xs hover:border-orange-400/50 disabled:opacity-50"
                    >
                      <span className="font-medium text-[var(--fg)]">
                        {RESPONSIBILITY_LABELS[r.type]}
                      </span>
                      <span className="truncate font-mono text-[10px] text-[var(--muted)]">
                        {[r.processId, r.locationId, r.assetId]
                          .filter(Boolean)
                          .join(" · ") || "ID оруулаагүй"}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            {addableTypes.length > 0 ? (
              <button
                type="button"
                disabled={pending || !clauseIds.length}
                onClick={openAdd}
                className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded border border-orange-400/50 bg-orange-500/15 px-2 py-1.5 text-xs text-orange-900 disabled:opacity-50 dark:text-orange-100"
              >
                <Plus size={12} />
                Үүргийн төрөл нэмэх
              </button>
            ) : (
              <p className="mb-2 text-[10px] text-[var(--muted)]">
                Бүх үүргийн төрөл нэмэгдсэн.
              </p>
            )}
            <button
              type="button"
              disabled={pending || roles.length === 0}
              onClick={() => void unlinkAll()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-800 hover:bg-rose-500/20 disabled:opacity-50 dark:text-rose-200"
            >
              <Unlink size={12} />
              Бүх холбоос салгах
            </button>
          </>
        ) : null}

        {view.kind === "add" || view.kind === "edit" ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => setView({ kind: "list" })}
              className="mb-2 inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--fg)]"
            >
              <ArrowLeft size={12} />
              Буцах
            </button>
            <div className="mb-2 text-[11px] font-medium text-[var(--fg)]">
              {view.kind === "add"
                ? "Шинэ үүргийн төрөл"
                : "Үүрэг засах"}
            </div>

            {view.kind === "add" ? (
              <>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Үүргийн төрөл
                </label>
                <select
                  className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
                  value={addType}
                  disabled={pending}
                  onChange={(e) =>
                    setAddType(e.target.value as ResponsibilityType)
                  }
                >
                  {addableTypes.map((t) => (
                    <option key={t} value={t}>
                      {RESPONSIBILITY_LABELS[t]}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Үүргийн төрөл
                </label>
                <select
                  className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs text-[var(--fg)]"
                  value={editType}
                  disabled={pending || editableTypes.length <= 1}
                  onChange={(e) =>
                    setEditType(e.target.value as ResponsibilityType)
                  }
                >
                  {editableTypes.map((t) => (
                    <option key={t} value={t}>
                      {RESPONSIBILITY_LABELS[t]}
                    </option>
                  ))}
                </select>
                {editType !== editingRole?.type ? (
                  <p className="mb-2 text-[10px] text-amber-800 dark:text-amber-200">
                    Төрөл солигдоно: {RESPONSIBILITY_LABELS[editingRole!.type]} →{" "}
                    {RESPONSIBILITY_LABELS[editType]}
                  </p>
                ) : null}
              </>
            )}

            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Process ID
            </label>
            <input
              value={processId}
              disabled={pending}
              placeholder="job_process_id"
              onChange={(e) => setProcessId(e.target.value)}
              className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 font-mono text-xs text-[var(--fg)]"
            />
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Location ID
            </label>
            <input
              value={locationId}
              disabled={pending}
              placeholder="job_location_id"
              onChange={(e) => setLocationId(e.target.value)}
              className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 font-mono text-xs text-[var(--fg)]"
            />
            <label className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Asset ID
            </label>
            <input
              value={assetId}
              disabled={pending}
              placeholder="job_asset_id"
              onChange={(e) => setAssetId(e.target.value)}
              className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 font-mono text-xs text-[var(--fg)]"
            />

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void (view.kind === "add" ? addRole() : saveEdit())
              }
              className="mb-1.5 w-full rounded bg-orange-500 px-2 py-1.5 text-xs text-white disabled:opacity-50"
            >
              {view.kind === "add" ? "Нэмэж хадгалах" : "Хадгалах"}
            </button>

            {view.kind === "edit" && editingRole ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void removeRole(editingRole.linkId, editingRole.type)
                }
                className="inline-flex w-full items-center justify-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-800 disabled:opacity-50 dark:text-rose-200"
              >
                <Trash2 size={12} />
                Энэ үүргийг арилгах
              </button>
            ) : null}
          </>
        ) : null}

        {error ? (
          <p className="mt-1.5 text-[11px] text-rose-700 dark:text-rose-300">
            {error}
          </p>
        ) : null}
      </FloatingPanel>
    </div>
  );
}
