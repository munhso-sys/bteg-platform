"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  EmployeeVoiceItem,
  VoicePriority,
  VoiceStatus,
  VoiceType,
} from "@/lib/voice/types";
import {
  VOICE_PRIORITY_LABELS,
  VOICE_STATUS_LABELS,
  VOICE_TYPE_LABELS,
} from "@/lib/voice/types";

type OrgAlba = { id: string; name: string };
type OrgHeltes = { id: string; name: string; albas: OrgAlba[] };
type OrgGroups = Array<{ heltes: string; options: string[] }>;

function OrgUnitSelect({
  value,
  onChange,
  emptyLabel,
  legacy,
  groups,
}: {
  value: string;
  onChange: (next: string) => void;
  emptyLabel: string;
  legacy: string;
  groups: OrgGroups;
}) {
  return (
    <select
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{emptyLabel}</option>
      {legacy ? <option value={legacy}>{legacy}</option> : null}
      {groups.map((g) => (
        <optgroup key={`${emptyLabel}:${g.heltes}`} label={g.heltes}>
          {g.options.map((name) => (
            <option key={`${emptyLabel}:${g.heltes}:${name}`} value={name}>
              {name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function VoiceFormModal({
  item,
  onClose,
  onSaved,
}: {
  item?: EmployeeVoiceItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const createMode = !item;
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [type, setType] = useState<VoiceType>(item?.type ?? "suggestion");
  const [status, setStatus] = useState<VoiceStatus>(item?.status ?? "new");
  const [priority, setPriority] = useState<VoicePriority>(item?.priority ?? "medium");
  const [department, setDepartment] = useState(item?.department ?? "");
  const [submittedBy, setSubmittedBy] = useState(item?.submittedBy ?? "");
  const [assignedTo, setAssignedTo] = useState(item?.assignedTo ?? "");
  const [dueDate, setDueDate] = useState(item?.dueDate ?? "");
  const [isAnonymous, setIsAnonymous] = useState(item?.isAnonymous ?? false);
  const [actionTaken, setActionTaken] = useState(item?.actionTaken ?? "");
  const [analysisNote, setAnalysisNote] = useState(item?.analysisNote ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [heltesList, setHeltesList] = useState<OrgHeltes[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/org/options", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok && data.ok) {
          setHeltesList(data.heltes ?? []);
        }
      } catch {
        // keep empty; free-text fallback via legacy option
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const orgOptions = useMemo(() => {
    const names = new Set<string>();
    const groups: OrgGroups = [];
    for (const h of heltesList) {
      const opts: string[] = [];
      for (const a of h.albas ?? []) {
        const label = a.name?.trim();
        if (!label || names.has(label)) continue;
        names.add(label);
        opts.push(label);
      }
      if (opts.length > 0) {
        groups.push({ heltes: h.name, options: opts });
      }
    }
    return { groups, names };
  }, [heltesList]);

  const legacyDepartment =
    department && !orgOptions.names.has(department) ? department : "";
  const legacyAssignee =
    assignedTo && !orgOptions.names.has(assignedTo) ? assignedTo : "";

  async function save() {
    setBusy(true);
    setError("");
    try {
      const payload = {
        title,
        description,
        type,
        status,
        priority,
        department,
        submittedBy,
        assignedTo,
        dueDate: dueDate || null,
        isAnonymous,
        actionTaken,
        analysisNote,
        autoClassify: createMode && !title,
      };
      const res = await fetch(
        createMode ? "/api/employee-voice" : `/api/employee-voice/${item!.id}`,
        {
          method: createMode ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Хадгалж чадсангүй");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {createMode ? "Шинэ бүртгэл" : "Бүртгэл засах"}
          </h2>
          <button type="button" className="btn btn-ghost px-2" onClick={onClose}>
            ×
          </button>
        </div>
        {error ? (
          <p className="mb-3 text-sm text-rose-700">{error}</p>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className="input md:col-span-2"
            placeholder="Гарчиг"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="textarea md:col-span-2 min-h-24"
            placeholder="Тайлбар"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as VoiceType)}
          >
            {Object.entries(VOICE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as VoicePriority)}
          >
            {Object.entries(VOICE_PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as VoiceStatus)}
          >
            {Object.entries(VOICE_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <OrgUnitSelect
            value={department}
            onChange={setDepartment}
            emptyLabel="Нэгж / алба (илгээгч)"
            legacy={legacyDepartment}
            groups={orgOptions.groups}
          />
          <input
            className="input"
            placeholder="Илгээгч"
            value={submittedBy}
            onChange={(e) => setSubmittedBy(e.target.value)}
            disabled={isAnonymous}
          />
          <OrgUnitSelect
            value={assignedTo}
            onChange={setAssignedTo}
            emptyLabel="Хариуцагч (алба, хэлтэс)"
            legacy={legacyAssignee}
            groups={orgOptions.groups}
          />
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-[var(--fg)]">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            Нэргүй
          </label>
          <textarea
            className="textarea md:col-span-2 min-h-20"
            placeholder="Шинжилгээ / боловсруулалт"
            value={analysisNote}
            onChange={(e) => setAnalysisNote(e.target.value)}
          />
          <textarea
            className="textarea md:col-span-2 min-h-20"
            placeholder="Авсан арга хэмжээ"
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Болих
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            Хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}
