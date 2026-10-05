"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  asCommunication,
  asSkillCategories,
  asTextList,
  defaultSkillCategories,
  JD_DEFAULT_COMPANY,
  JD_DEFAULT_LOCATION,
} from "@/lib/job-description/normalize";
import {
  JdCollapsibleSection,
  JdSectionControls,
  useJdSectionOpenState,
} from "@/components/job-description/jd-collapsible-section";
import { withBasePath } from "@/lib/paths";
import type {
  JobDescription,
  JobDescriptionSkillCategory,
} from "@/lib/types";

const inputClass =
  "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm";
const areaClass =
  "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm leading-relaxed";

type SkillCatState = JobDescriptionSkillCategory & { key: string };

function newKey() {
  return `k-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureRows(list: string[], min = 1) {
  return list.length ? list : Array.from({ length: min }, () => "");
}

function NumberedRows({
  label,
  rows,
  onChange,
  placeholder,
  minRows = 1,
}: {
  label: string;
  rows: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  minRows?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => onChange([...rows, ""])}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Мөр нэмэх
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="mt-2 w-7 shrink-0 text-center text-xs font-semibold tabular-nums text-slate-500">
              {index + 1}.
            </span>
            <textarea
              value={row}
              rows={2}
              className={areaClass}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...rows];
                next[index] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              className="mt-1 rounded border border-slate-200 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
              aria-label={`${index + 1}-р мөрийг хасах`}
              disabled={rows.length <= minRows}
              onClick={() => {
                if (rows.length <= minRows) return;
                onChange(rows.filter((_, i) => i !== index));
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
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

function SectionBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 bg-white p-3">{children}</div>;
}

function draftFromInitial(
  initial: Partial<JobDescription> | null,
): {
  company_name: string;
  location: string;
  unit_name: string;
  title: string;
  a_code: string;
  position_code: string;
  supervisors: string[];
  subordinates: string[];
  job_condition: string;
  communication_internal: string;
  communication_external: string;
  purpose: string;
  schedule: string;
  daily_hours: string;
  break_time: string;
  position_note: string;
  duties: string[];
  education_level: string;
  work_experience: string;
  general_skills: string[];
  skillCats: SkillCatState[];
  required_trainings: string[];
  required_certificates: string[];
  resources: string;
  authority: string[];
  responsibilities: string[];
  property_liability: string;
  other_notes: string;
  relevant_laws: string[];
  markdown_body: string;
} {
  const d = initial ?? {};
  const comm = asCommunication(d.communication_scope);
  const cats = asSkillCategories(d.professional_skills);
  return {
    company_name: d.company_name ?? JD_DEFAULT_COMPANY,
    location: d.location ?? JD_DEFAULT_LOCATION,
    unit_name: d.unit_name ?? "",
    title: d.title ?? "",
    a_code: d.a_code ?? "",
    position_code: d.position_code ?? "",
    supervisors: ensureRows(asTextList(d.supervisor_positions)),
    subordinates: ensureRows(asTextList(d.subordinate_positions)),
    job_condition: d.job_condition ?? "Хэвийн",
    communication_internal: comm.internal,
    communication_external: comm.external,
    purpose: d.purpose ?? "",
    schedule: d.schedule ?? "",
    daily_hours: d.daily_hours ?? "",
    break_time: d.break_time ?? "",
    position_note:
      d.position_note ??
      "Хөдөлмөрийн дотоод журмын холбогдох заалтад заасныг ойлгоно.",
    duties: ensureRows(asTextList(d.duties)),
    education_level: d.education_level ?? "",
    work_experience: d.work_experience ?? "",
    general_skills: ensureRows(asTextList(d.general_skills)),
    skillCats: (cats.length ? cats : defaultSkillCategories()).map((c) => ({
      key: newKey(),
      title: c.title,
      items: ensureRows(c.items),
    })),
    required_trainings: ensureRows(asTextList(d.required_trainings)),
    required_certificates: ensureRows(asTextList(d.required_certificates)),
    resources: d.resources ?? "",
    authority: ensureRows(asTextList(d.authority)),
    responsibilities: ensureRows(asTextList(d.responsibilities)),
    property_liability: d.property_liability ?? "",
    other_notes: d.other_notes ?? "",
    relevant_laws: ensureRows(asTextList(d.relevant_laws)),
    markdown_body: d.markdown_body ?? "",
  };
}

export function JobDescriptionForm({
  positionId,
  initial,
  onSaved,
}: {
  positionId: string;
  initial: Partial<JobDescription> | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const seed = useMemo(() => draftFromInitial(initial), [initial]);
  const [companyName, setCompanyName] = useState(seed.company_name);
  const [location, setLocation] = useState(seed.location);
  const [unitName, setUnitName] = useState(seed.unit_name);
  const [title, setTitle] = useState(seed.title);
  const [aCode, setACode] = useState(seed.a_code);
  const [positionCode, setPositionCode] = useState(seed.position_code);
  const [supervisors, setSupervisors] = useState(seed.supervisors);
  const [subordinates, setSubordinates] = useState(seed.subordinates);
  const [jobCondition, setJobCondition] = useState(seed.job_condition);
  const [commInternal, setCommInternal] = useState(seed.communication_internal);
  const [commExternal, setCommExternal] = useState(seed.communication_external);
  const [purpose, setPurpose] = useState(seed.purpose);
  const [schedule, setSchedule] = useState(seed.schedule);
  const [dailyHours, setDailyHours] = useState(seed.daily_hours);
  const [breakTime, setBreakTime] = useState(seed.break_time);
  const [positionNote, setPositionNote] = useState(seed.position_note);
  const [duties, setDuties] = useState(seed.duties);
  const [educationLevel, setEducationLevel] = useState(seed.education_level);
  const [workExperience, setWorkExperience] = useState(seed.work_experience);
  const [generalSkills, setGeneralSkills] = useState(seed.general_skills);
  const [skillCats, setSkillCats] = useState(seed.skillCats);
  const [trainings, setTrainings] = useState(seed.required_trainings);
  const [certificates, setCertificates] = useState(seed.required_certificates);
  const [resources, setResources] = useState(seed.resources);
  const [authority, setAuthority] = useState(seed.authority);
  const [responsibilities, setResponsibilities] = useState(
    seed.responsibilities,
  );
  const [propertyLiability, setPropertyLiability] = useState(
    seed.property_liability,
  );
  const [otherNotes, setOtherNotes] = useState(seed.other_notes);
  const [relevantLaws, setRelevantLaws] = useState(seed.relevant_laws);
  const [markdownBody] = useState(seed.markdown_body);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const { openMap, setSection, expandAll, collapseAll } =
    useJdSectionOpenState();

  function cleanList(rows: string[]) {
    return rows.map((r) => r.trim()).filter(Boolean);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMsg(null);

    const professional_skills = skillCats
      .map((c) => ({
        title: c.title.trim(),
        items: cleanList(c.items),
      }))
      .filter((c) => c.title || c.items.length);

    try {
      const res = await fetch(withBasePath("/api/job-descriptions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_position_id: positionId,
          company_name: companyName.trim() || null,
          location: location.trim() || null,
          unit_name: unitName.trim() || null,
          title: title.trim() || null,
          a_code: aCode.trim() || null,
          position_code: positionCode.trim() || null,
          supervisor_positions: cleanList(supervisors),
          subordinate_positions: cleanList(subordinates),
          job_condition: jobCondition.trim() || null,
          communication_scope: {
            company_internal: commInternal.trim(),
            external: commExternal.trim(),
          },
          purpose: purpose.trim() || null,
          schedule: schedule.trim() || null,
          daily_hours: dailyHours.trim() || null,
          break_time: breakTime.trim() || null,
          position_note: positionNote.trim() || null,
          duties: cleanList(duties),
          education_level: educationLevel.trim() || null,
          work_experience: workExperience.trim() || null,
          general_skills: cleanList(generalSkills),
          professional_skills,
          required_trainings: cleanList(trainings),
          required_certificates: cleanList(certificates),
          resources: resources.trim() || null,
          authority: cleanList(authority),
          responsibilities: cleanList(responsibilities),
          property_liability: propertyLiability.trim() || null,
          other_notes: otherNotes.trim() || null,
          relevant_laws: cleanList(relevantLaws),
          markdown_body: markdownBody.trim() || null,
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
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-sm">
      <JdSectionControls onExpandAll={expandAll} onCollapseAll={collapseAll} />

      <JdCollapsibleSection
        title="А. Нийтлэг үндэслэл"
        open={openMap.A}
        onOpenChange={(v) => setSection("A", v)}
      >
        <SectionBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Компанийн нэр">
              <input
                className={inputClass}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </Field>
            <Field label="Байршил">
              <input
                className={inputClass}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
            <Field label="Нэгжийн нэр">
              <input
                className={inputClass}
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
              />
            </Field>
            <Field label="Албан тушаалын нэр">
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Үндэсний ажил мэргэжлийн ангиллын код">
              <input
                className={inputClass}
                value={aCode}
                onChange={(e) => setACode(e.target.value)}
                placeholder="жнь. 1322-11"
              />
            </Field>
            <Field label="Албан тушаалын код">
              <input
                className={inputClass}
                value={positionCode}
                onChange={(e) => setPositionCode(e.target.value)}
                placeholder="жнь. 103"
              />
            </Field>
            <Field label="Хөдөлмөрийн нөхцөл">
              <input
                className={inputClass}
                value={jobCondition}
                onChange={(e) => setJobCondition(e.target.value)}
              />
            </Field>
          </div>
          <NumberedRows
            label="Шууд харьяалагдах албан тушаал"
            rows={supervisors}
            onChange={setSupervisors}
            placeholder="Албан тушаалын нэр"
          />
          <NumberedRows
            label="Шууд харьяалах албан тушаал"
            rows={subordinates}
            onChange={setSubordinates}
            placeholder="Албан тушаалын нэр"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Харилцах хүрээ — Компани дотор">
              <textarea
                className={areaClass}
                rows={3}
                value={commInternal}
                onChange={(e) => setCommInternal(e.target.value)}
              />
            </Field>
            <Field label="Харилцах хүрээ — Гадна">
              <textarea
                className={areaClass}
                rows={3}
                value={commExternal}
                onChange={(e) => setCommExternal(e.target.value)}
              />
            </Field>
          </div>
        </SectionBody>
      </JdCollapsibleSection>

      <JdCollapsibleSection
        title="B. Албан тушаалын дэлгэрэнгүй мэдээлэл"
        open={openMap.B}
        onOpenChange={(v) => setSection("B", v)}
      >
        <SectionBody>
          <Field label="Албан тушаалын зорилго">
            <textarea
              className={areaClass}
              rows={5}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </Field>
          <Field label="Ажлын хуваарийн талаарх мэдээлэл">
            <textarea
              className={areaClass}
              rows={3}
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ажлын өдрийн цаг">
              <input
                className={inputClass}
                value={dailyHours}
                onChange={(e) => setDailyHours(e.target.value)}
              />
            </Field>
            <Field label="Өдрийн цайны цаг">
              <input
                className={inputClass}
                value={breakTime}
                onChange={(e) => setBreakTime(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Албан тушаал (тайлбар)">
            <textarea
              className={areaClass}
              rows={2}
              value={positionNote}
              onChange={(e) => setPositionNote(e.target.value)}
            />
          </Field>
        </SectionBody>
      </JdCollapsibleSection>

      <JdCollapsibleSection
        title="С. Албан тушаалын гүйцэтгэх үүрэг"
        open={openMap.C}
        onOpenChange={(v) => setSection("C", v)}
        badge={
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] tabular-nums">
            {duties.filter((d) => d.trim()).length}
          </span>
        }
      >
        <SectionBody>
          <NumberedRows
            label="Гүйцэтгэх ажил үүрэг"
            rows={duties}
            onChange={setDuties}
            placeholder="Үүргийн тайлбар"
          />
        </SectionBody>
      </JdCollapsibleSection>

      <JdCollapsibleSection
        title="D. Албан тушаалд тавигдах шаардлага"
        open={openMap.D}
        onOpenChange={(v) => setSection("D", v)}
      >
        <SectionBody>
          <Field label="Боловсролын түвшин">
            <textarea
              className={areaClass}
              rows={3}
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value)}
            />
          </Field>
          <Field label="Ажлын туршлага">
            <textarea
              className={areaClass}
              rows={2}
              value={workExperience}
              onChange={(e) => setWorkExperience(e.target.value)}
            />
          </Field>
          <NumberedRows
            label="Ерөнхий ур чадвар"
            rows={generalSkills}
            onChange={setGeneralSkills}
          />

          <div className="space-y-3 rounded border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Мэргэжлийн ур чадвар (ангилал)
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                onClick={() =>
                  setSkillCats((prev) => [
                    ...prev,
                    { key: newKey(), title: "", items: [""] },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Ангилал нэмэх
              </button>
            </div>
            {skillCats.map((cat, catIndex) => (
              <div
                key={cat.key}
                className="space-y-2 rounded border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-xs font-semibold text-slate-500">
                    {catIndex + 1}.
                  </span>
                  <input
                    className={inputClass}
                    value={cat.title}
                    placeholder="Ангиллын нэр (жнь. Дүн шинжилгээ хийх)"
                    onChange={(e) => {
                      const next = [...skillCats];
                      next[catIndex] = { ...cat, title: e.target.value };
                      setSkillCats(next);
                    }}
                  />
                  <button
                    type="button"
                    className="rounded border border-slate-200 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                    disabled={skillCats.length <= 1}
                    aria-label="Ангилал хасах"
                    onClick={() =>
                      setSkillCats((prev) =>
                        prev.length <= 1
                          ? prev
                          : prev.filter((_, i) => i !== catIndex),
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <NumberedRows
                  label="Зүйлүүд"
                  rows={cat.items}
                  onChange={(items) => {
                    const next = [...skillCats];
                    next[catIndex] = { ...cat, items };
                    setSkillCats(next);
                  }}
                />
              </div>
            ))}
          </div>

          <NumberedRows
            label="Хамрагдсан байвал зохих сургалтууд"
            rows={trainings}
            onChange={setTrainings}
          />
          <NumberedRows
            label="Сертификат, зөвшөөрөл, лиценз"
            rows={certificates}
            onChange={setCertificates}
          />
        </SectionBody>
      </JdCollapsibleSection>

      <JdCollapsibleSection
        title="E. Бусад хүчин зүйлс"
        open={openMap.E}
        onOpenChange={(v) => setSection("E", v)}
      >
        <SectionBody>
          <Field label="Албан тушаалын нөөц хэрэгсэл (тоног төхөөрөмж)">
            <textarea
              className={areaClass}
              rows={2}
              value={resources}
              onChange={(e) => setResources(e.target.value)}
            />
          </Field>
          <NumberedRows
            label="Албан тушаалын эрх мэдэл"
            rows={authority}
            onChange={setAuthority}
          />
          <NumberedRows
            label="Албан тушаалын хариуцлага"
            rows={responsibilities}
            onChange={setResponsibilities}
          />
          <Field label="Эд хөрөнгийн хариуцлага">
            <textarea
              className={areaClass}
              rows={3}
              value={propertyLiability}
              onChange={(e) => setPropertyLiability(e.target.value)}
            />
          </Field>
          <Field label="Бусад">
            <textarea
              className={areaClass}
              rows={3}
              value={otherNotes}
              onChange={(e) => setOtherNotes(e.target.value)}
            />
          </Field>
          <NumberedRows
            label="Холбогдох хууль тогтоомж, дүрэм журам"
            rows={relevantLaws}
            onChange={setRelevantLaws}
          />
        </SectionBody>
      </JdCollapsibleSection>

      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-700">{msg}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="sticky bottom-0 w-full rounded bg-slate-900 px-3 py-2.5 text-white disabled:opacity-50"
      >
        {pending ? "Хадгалж байна…" : "Тодорхойлолт хадгалах"}
      </button>
    </form>
  );
}
