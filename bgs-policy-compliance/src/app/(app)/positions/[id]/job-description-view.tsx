"use client";

import type { JobDescription } from "@/lib/types";
import {
  asCommunication,
  asSkillCategories,
  asTextList,
  documentHeading,
  JD_DEFAULT_COMPANY,
  JD_DEFAULT_LOCATION,
} from "@/lib/job-description/normalize";
import {
  JdCollapsibleSection,
  JdSectionControls,
  useJdSectionOpenState,
} from "@/components/job-description/jd-collapsible-section";

function cellText(value: string | null | undefined) {
  const t = (value ?? "").trim();
  return t || "—";
}

function NumberedList({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-slate-400">—</span>;
  return (
    <ol className="m-0 list-decimal space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-slate-400">—</span>;
  return (
    <ul className="m-0 list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

function DocTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-0.5 overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse border-0 text-[13px] leading-relaxed text-slate-900 sm:min-w-0">
        {children}
      </table>
    </div>
  );
}

function LabelCell({
  children,
  rowSpan,
  colSpan,
  className = "",
}: {
  children: React.ReactNode;
  rowSpan?: number;
  colSpan?: number;
  className?: string;
}) {
  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`border border-slate-800 bg-slate-100 px-2.5 py-2 text-left align-top font-semibold text-slate-800 ${className}`}
    >
      {children}
    </th>
  );
}

function ValueCell({
  children,
  colSpan,
  className = "",
}: {
  children: React.ReactNode;
  colSpan?: number;
  className?: string;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border border-slate-800 px-2.5 py-2 align-top whitespace-pre-wrap text-slate-900 ${className}`}
    >
      {children}
    </td>
  );
}

export function JobDescriptionView({
  description,
}: {
  description: JobDescription;
}) {
  const { openMap, setSection, expandAll, collapseAll } =
    useJdSectionOpenState();

  const duties = asTextList(description.duties);
  const generalSkills = asTextList(description.general_skills);
  const skillCats = asSkillCategories(description.professional_skills);
  const laws = asTextList(description.relevant_laws);
  const authority = asTextList(description.authority);
  const responsibilities = asTextList(description.responsibilities);
  const supervisors = asTextList(description.supervisor_positions);
  const subordinates = asTextList(description.subordinate_positions);
  const trainings = asTextList(description.required_trainings);
  const certificates = asTextList(description.required_certificates);
  const comm = asCommunication(description.communication_scope);
  const heading = documentHeading(description);

  const hasAny =
    Boolean(description.title?.trim()) ||
    Boolean(description.purpose?.trim()) ||
    duties.length > 0 ||
    Boolean(description.markdown_body?.trim()) ||
    Boolean(description.company_name?.trim());

  if (!hasAny) {
    return (
      <p className="text-sm text-slate-500">Ажлын байрны тодорхойлолт байхгүй.</p>
    );
  }

  return (
    <article className="min-w-0 overflow-hidden rounded border border-slate-300 bg-[#fafaf8] shadow-sm">
      <header className="border-b border-slate-300 bg-white px-3 py-4 text-center sm:px-4 sm:py-5">
        <h3 className="text-sm font-bold leading-snug tracking-wide text-slate-950 uppercase sm:text-[15px]">
          {heading}
        </h3>
        <p className="mt-1 text-xs font-semibold tracking-wider text-slate-600 uppercase">
          Албан тушаалын тодорхойлолт
        </p>
      </header>

      <div className="space-y-3 p-3 sm:p-4">
        <JdSectionControls
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
        />

        <JdCollapsibleSection
          title="А. Нийтлэг үндэслэл"
          open={openMap.A}
          onOpenChange={(v) => setSection("A", v)}
        >
          <DocTable>
            <tbody>
              {(
                [
                  [
                    "Компанийн нэр:",
                    cellText(description.company_name ?? JD_DEFAULT_COMPANY),
                  ],
                  [
                    "Байршил:",
                    cellText(description.location ?? JD_DEFAULT_LOCATION),
                  ],
                  ["Нэгжийн нэр:", cellText(description.unit_name)],
                  ["Албан тушаалын нэр:", cellText(description.title)],
                  [
                    "Үндэсний ажил мэргэжлийн ангиллын код",
                    cellText(description.a_code),
                  ],
                  ["Албан тушаалын код", cellText(description.position_code)],
                  [
                    "Шууд харьяалагдах албан тушаал:",
                    supervisors.length ? (
                      <BulletList items={supervisors} />
                    ) : (
                      "—"
                    ),
                  ],
                  [
                    "Шууд харьяалах албан тушаал:",
                    subordinates.length ? (
                      <BulletList items={subordinates} />
                    ) : (
                      "—"
                    ),
                  ],
                  ["Хөдөлмөрийн нөхцөл", cellText(description.job_condition)],
                ] as Array<[string, React.ReactNode]>
              ).map(([label, value]) => (
                <tr key={label}>
                  <LabelCell className="w-[34%]">{label}</LabelCell>
                  <ValueCell>{value}</ValueCell>
                </tr>
              ))}
              <tr>
                <LabelCell rowSpan={2}>Харилцах хүрээ:</LabelCell>
                <ValueCell>
                  <span className="font-semibold">-Компани дотор: </span>
                  {comm.internal.trim() || "—"}
                </ValueCell>
              </tr>
              <tr>
                <ValueCell>
                  <span className="font-semibold">-Гадна: </span>
                  {comm.external.trim() || "—"}
                </ValueCell>
              </tr>
            </tbody>
          </DocTable>
        </JdCollapsibleSection>

        <JdCollapsibleSection
          title="B. Албан тушаалын дэлгэрэнгүй мэдээлэл"
          open={openMap.B}
          onOpenChange={(v) => setSection("B", v)}
        >
          <DocTable>
            <tbody>
              {(
                [
                  ["Албан тушаалын зорилго:", cellText(description.purpose)],
                  [
                    "Ажлын хуваарийн талаарх мэдээлэл:",
                    cellText(description.schedule),
                  ],
                  ["Ажлын өдрийн цаг:", cellText(description.daily_hours)],
                  ["Өдрийн цайны цаг:", cellText(description.break_time)],
                  ["Албан тушаал:", cellText(description.position_note)],
                ] as Array<[string, React.ReactNode]>
              ).map(([label, value]) => (
                <tr key={label}>
                  <LabelCell className="w-[34%]">{label}</LabelCell>
                  <ValueCell>{value}</ValueCell>
                </tr>
              ))}
            </tbody>
          </DocTable>
        </JdCollapsibleSection>

        <JdCollapsibleSection
          title="С. Албан тушаалын гүйцэтгэх үүрэг"
          open={openMap.C}
          onOpenChange={(v) => setSection("C", v)}
          badge={
            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] tabular-nums">
              {duties.length}
            </span>
          }
        >
          <DocTable>
            <thead>
              <tr className="bg-slate-200">
                <th className="w-12 border border-slate-800 px-2 py-2 text-center font-semibold">
                  №
                </th>
                <th className="border border-slate-800 px-2.5 py-2 text-left font-semibold">
                  Албан тушаалын гүйцэтгэх ажил үүрэг
                </th>
              </tr>
            </thead>
            <tbody>
              {duties.length === 0 ? (
                <tr>
                  <ValueCell colSpan={2}>Үүрэг бүртгээгүй.</ValueCell>
                </tr>
              ) : (
                duties.map((duty, i) => (
                  <tr key={`${i}-${duty.slice(0, 20)}`}>
                    <td className="border border-slate-800 px-2 py-2 text-center tabular-nums font-medium text-slate-700">
                      {i + 1}
                    </td>
                    <ValueCell>{duty}</ValueCell>
                  </tr>
                ))
              )}
            </tbody>
          </DocTable>
        </JdCollapsibleSection>

        <JdCollapsibleSection
          title="D. Албан тушаалд тавигдах шаардлага"
          open={openMap.D}
          onOpenChange={(v) => setSection("D", v)}
        >
          <DocTable>
            <tbody>
              <tr>
                <LabelCell colSpan={3} className="bg-slate-200">
                  Ерөнхий шаардлага
                </LabelCell>
              </tr>
              <tr>
                <LabelCell className="w-[28%]">Боловсролын түвшин:</LabelCell>
                <ValueCell colSpan={2}>
                  {cellText(description.education_level)}
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>Ажлын туршлага:</LabelCell>
                <ValueCell colSpan={2}>
                  {cellText(description.work_experience)}
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>Ерөнхий ур чадвар:</LabelCell>
                <ValueCell colSpan={2}>
                  <BulletList items={generalSkills} />
                </ValueCell>
              </tr>
              {skillCats.length === 0 ? (
                <tr>
                  <LabelCell>Мэргэжлийн ур чадвар</LabelCell>
                  <ValueCell colSpan={2}>—</ValueCell>
                </tr>
              ) : (
                skillCats.map((cat, idx) => (
                  <tr key={`${cat.title}-${idx}`}>
                    {idx === 0 ? (
                      <LabelCell rowSpan={skillCats.length}>
                        Мэргэжлийн ур чадвар
                      </LabelCell>
                    ) : null}
                    <td className="w-[22%] border border-slate-800 bg-slate-50 px-2.5 py-2 align-top font-medium">
                      {cat.title || "—"}
                    </td>
                    <ValueCell>
                      <BulletList items={cat.items} />
                    </ValueCell>
                  </tr>
                ))
              )}
              <tr>
                <LabelCell colSpan={3} className="bg-slate-200">
                  Нэмэлт шаардлага
                </LabelCell>
              </tr>
              <tr>
                <LabelCell>Хамрагдсан байвал зохих сургалтууд:</LabelCell>
                <ValueCell colSpan={2}>
                  <BulletList items={trainings} />
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>Сертификат, зөвшөөрөл, лиценз:</LabelCell>
                <ValueCell colSpan={2}>
                  <BulletList items={certificates} />
                </ValueCell>
              </tr>
            </tbody>
          </DocTable>
        </JdCollapsibleSection>

        <JdCollapsibleSection
          title="E. Бусад хүчин зүйлс"
          open={openMap.E}
          onOpenChange={(v) => setSection("E", v)}
        >
          <DocTable>
            <tbody>
              <tr>
                <LabelCell className="w-[34%]">
                  Албан тушаалын нөөц хэрэгсэл (тоног төхөөрөмж):
                </LabelCell>
                <ValueCell>{cellText(description.resources)}</ValueCell>
              </tr>
              <tr>
                <LabelCell>Албан тушаалын эрх мэдэл:</LabelCell>
                <ValueCell>
                  <NumberedList items={authority} />
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>Албан тушаалын хариуцлага:</LabelCell>
                <ValueCell>
                  <NumberedList items={responsibilities} />
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>Эд хөрөнгийн хариуцлага:</LabelCell>
                <ValueCell>
                  {cellText(description.property_liability)}
                </ValueCell>
              </tr>
              <tr>
                <LabelCell>Бусад</LabelCell>
                <ValueCell>{cellText(description.other_notes)}</ValueCell>
              </tr>
              <tr>
                <LabelCell>
                  Энэхүү ажил үүргийг хийж гүйцэтгэхтэй холбоотой мэдсэн байх
                  гол хууль тогтоомж, дүрэм журмууд:
                </LabelCell>
                <ValueCell>
                  <NumberedList items={laws} />
                </ValueCell>
              </tr>
            </tbody>
          </DocTable>
        </JdCollapsibleSection>
      </div>
    </article>
  );
}
