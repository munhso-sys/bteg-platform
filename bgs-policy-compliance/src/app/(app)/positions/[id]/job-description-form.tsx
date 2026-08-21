"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { withBasePath } from "@/lib/paths";
import type { JobDescription } from "@/lib/types";

function listToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (typeof o.text === "string") return o.text.trim();
        if (typeof o.name === "string") return o.name.trim();
      }
      return String(item ?? "").trim();
    })
    .filter(Boolean)
    .join("\n");
}

function textToList(value: FormDataEntryValue | null): string[] {
  const raw = String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return raw;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm";
const areaClass =
  "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm leading-relaxed";

export function JobDescriptionForm({
  positionId,
  initial,
}: {
  positionId: string;
  initial: Partial<JobDescription> | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const defaults = useMemo(() => {
    const d = initial ?? {};
    let communication = "";
    if (typeof d.communication_scope === "string") {
      communication = d.communication_scope;
    } else if (d.communication_scope != null) {
      try {
        communication = JSON.stringify(d.communication_scope, null, 2);
      } catch {
        communication = String(d.communication_scope);
      }
    }
    return {
      title: d.title ?? "",
      a_code: d.a_code ?? "",
      job_condition: d.job_condition ?? "",
      purpose: d.purpose ?? "",
      schedule: d.schedule ?? "",
      daily_hours: d.daily_hours ?? "",
      break_time: d.break_time ?? "",
      duties: listToText(d.duties),
      education_level: d.education_level ?? "",
      work_experience: d.work_experience ?? "",
      general_skills: listToText(d.general_skills),
      professional_skills: listToText(d.professional_skills),
      authority: d.authority ?? "",
      responsibilities: d.responsibilities ?? "",
      relevant_laws: listToText(d.relevant_laws),
      resources: d.resources ?? "",
      communication_scope: communication,
    };
  }, [initial]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);

    let communication_scope: unknown = null;
    const commRaw = String(fd.get("communication_scope") ?? "").trim();
    if (commRaw) {
      try {
        communication_scope = JSON.parse(commRaw);
      } catch {
        communication_scope = commRaw;
      }
    }

    try {
      const res = await fetch(withBasePath("/api/job-descriptions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_position_id: positionId,
          title: String(fd.get("title") ?? "").trim() || null,
          a_code: String(fd.get("a_code") ?? "").trim() || null,
          job_condition: String(fd.get("job_condition") ?? "").trim() || null,
          purpose: String(fd.get("purpose") ?? "").trim() || null,
          schedule: String(fd.get("schedule") ?? "").trim() || null,
          daily_hours: String(fd.get("daily_hours") ?? "").trim() || null,
          break_time: String(fd.get("break_time") ?? "").trim() || null,
          duties: textToList(fd.get("duties")),
          education_level:
            String(fd.get("education_level") ?? "").trim() || null,
          work_experience:
            String(fd.get("work_experience") ?? "").trim() || null,
          general_skills: textToList(fd.get("general_skills")),
          professional_skills: textToList(fd.get("professional_skills")),
          authority: String(fd.get("authority") ?? "").trim() || null,
          responsibilities:
            String(fd.get("responsibilities") ?? "").trim() || null,
          relevant_laws: textToList(fd.get("relevant_laws")),
          resources: String(fd.get("resources") ?? "").trim() || null,
          communication_scope,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      setMsg("Хадгаллаа");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-h-[70vh] space-y-3 overflow-auto pr-1 text-sm"
    >
      <Field label="Гарчиг">
        <input
          name="title"
          defaultValue={defaults.title}
          className={inputClass}
          placeholder="Гарчиг"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Код">
          <input
            name="a_code"
            defaultValue={defaults.a_code}
            className={inputClass}
            placeholder="жнь. 5116-16"
          />
        </Field>
        <Field label="Ажлын нөхцөл">
          <input
            name="job_condition"
            defaultValue={defaults.job_condition}
            className={inputClass}
            placeholder="Хэвийн / Хүнд…"
          />
        </Field>
      </div>

      <Field label="Зорилго">
        <textarea
          name="purpose"
          defaultValue={defaults.purpose}
          rows={4}
          className={areaClass}
          placeholder="Ажлын байрны зорилго"
        />
      </Field>

      <Field label="Хуваарь">
        <textarea
          name="schedule"
          defaultValue={defaults.schedule}
          rows={2}
          className={areaClass}
          placeholder="Ажлын хуваарь"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Өдрийн цаг">
          <input
            name="daily_hours"
            defaultValue={defaults.daily_hours}
            className={inputClass}
            placeholder="11 цаг"
          />
        </Field>
        <Field label="Завсарлага">
          <input
            name="break_time"
            defaultValue={defaults.break_time}
            className={inputClass}
            placeholder="1 цаг"
          />
        </Field>
      </div>

      <Field label="Үндсэн үүрэг (мөр бүр нэг үүрэг)">
        <textarea
          name="duties"
          defaultValue={defaults.duties}
          rows={8}
          className={areaClass}
          placeholder={"Үүрэг 1\nҮүрэг 2"}
        />
      </Field>

      <Field label="Боловсрол">
        <textarea
          name="education_level"
          defaultValue={defaults.education_level}
          rows={3}
          className={areaClass}
        />
      </Field>
      <Field label="Ажлын туршлага">
        <textarea
          name="work_experience"
          defaultValue={defaults.work_experience}
          rows={3}
          className={areaClass}
        />
      </Field>

      <Field label="Ерөнхий ур чадвар (мөр бүр)">
        <textarea
          name="general_skills"
          defaultValue={defaults.general_skills}
          rows={5}
          className={areaClass}
        />
      </Field>
      <Field label="Мэргэжлийн ур чадвар (мөр бүр)">
        <textarea
          name="professional_skills"
          defaultValue={defaults.professional_skills}
          rows={6}
          className={areaClass}
        />
      </Field>

      <Field label="Эрх">
        <textarea
          name="authority"
          defaultValue={defaults.authority}
          rows={5}
          className={areaClass}
        />
      </Field>
      <Field label="Хариуцлага">
        <textarea
          name="responsibilities"
          defaultValue={defaults.responsibilities}
          rows={5}
          className={areaClass}
        />
      </Field>

      <Field label="Холбогдох хууль, журам (мөр бүр)">
        <textarea
          name="relevant_laws"
          defaultValue={defaults.relevant_laws}
          rows={5}
          className={areaClass}
        />
      </Field>
      <Field label="Нөөц / хэрэгсэл">
        <textarea
          name="resources"
          defaultValue={defaults.resources}
          rows={2}
          className={areaClass}
        />
      </Field>
      <Field label="Харилцааны хамрах хүрээ (JSON эсвэл текст)">
        <textarea
          name="communication_scope"
          defaultValue={defaults.communication_scope}
          rows={5}
          className={`${areaClass} font-mono text-xs`}
          placeholder='{"company_internal":{"employees":true}}'
        />
      </Field>

      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-700">{msg}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="sticky bottom-0 w-full rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Хадгалж байна…" : "Тодорхойлолт хадгалах"}
      </button>
    </form>
  );
}
