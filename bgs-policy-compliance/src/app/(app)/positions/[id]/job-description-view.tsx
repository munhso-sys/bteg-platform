import type { JobDescription } from "@/lib/types";

function asList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (typeof o.text === "string") return o.text.trim();
        if (typeof o.name === "string") return o.name.trim();
        return JSON.stringify(item);
      }
      return String(item ?? "").trim();
    })
    .filter(Boolean);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  if (children == null || children === "" || children === false) return null;
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h4>
      <div className="text-sm text-slate-800">{children}</div>
    </section>
  );
}

function Paragraph({ text }: { text: string | null | undefined }) {
  const t = (text ?? "").trim();
  if (!t) return null;
  return <p className="whitespace-pre-wrap leading-relaxed">{t}</p>;
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function formatCommunication(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const lines: string[] = [];
    const internal = o.company_internal as Record<string, unknown> | undefined;
    const external = o.external as Record<string, unknown> | undefined;
    if (internal) {
      const parts = Object.entries(internal)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (parts.length) lines.push(`Дотоод: ${parts.join(", ")}`);
    }
    if (external) {
      const parts = Object.entries(external)
        .filter(([, v]) => v)
        .map(([k]) => k);
      if (parts.length) lines.push(`Гадаад: ${parts.join(", ")}`);
    }
    if (lines.length) return lines.join("\n");
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function JobDescriptionView({
  description,
}: {
  description: JobDescription;
}) {
  const duties = asList(description.duties);
  const generalSkills = asList(description.general_skills);
  const professionalSkills = asList(description.professional_skills);
  const laws = asList(description.relevant_laws);
  const communication = formatCommunication(description.communication_scope);

  const hasStructured =
    Boolean(description.purpose?.trim()) ||
    duties.length > 0 ||
    Boolean(description.education_level?.trim()) ||
    generalSkills.length > 0 ||
    professionalSkills.length > 0 ||
    Boolean(description.authority?.trim()) ||
    Boolean(description.responsibilities?.trim());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {description.title ? (
          <span>
            Гарчиг: <strong className="text-slate-800">{description.title}</strong>
          </span>
        ) : null}
        {description.a_code ? (
          <span>
            Код: <span className="font-mono">{description.a_code}</span>
          </span>
        ) : null}
        {description.job_condition ? (
          <span>Нөхцөл: {description.job_condition}</span>
        ) : null}
      </div>

      {hasStructured ? (
        <div className="max-h-[560px] space-y-4 overflow-auto rounded border border-slate-200 bg-slate-50/40 p-3">
          <Section title="Зорилго">
            <Paragraph text={description.purpose} />
          </Section>
          <Section title="Хуваарь / цаг">
            <div className="grid gap-2 sm:grid-cols-3">
              <div>Хуваарь: {description.schedule || "—"}</div>
              <div>Өдрийн цаг: {description.daily_hours || "—"}</div>
              <div>Завсарлага: {description.break_time || "—"}</div>
            </div>
          </Section>
          <Section title="Үндсэн үүрэг">
            <BulletList items={duties} />
          </Section>
          <Section title="Боловсрол">
            <Paragraph text={description.education_level} />
          </Section>
          <Section title="Ажлын туршлага">
            <Paragraph text={description.work_experience} />
          </Section>
          <Section title="Ерөнхий ур чадвар">
            <BulletList items={generalSkills} />
          </Section>
          <Section title="Мэргэжлийн ур чадвар">
            <BulletList items={professionalSkills} />
          </Section>
          <Section title="Эрх">
            <Paragraph text={description.authority} />
          </Section>
          <Section title="Хариуцлага">
            <Paragraph text={description.responsibilities} />
          </Section>
          <Section title="Холбогдох хууль, журам">
            <BulletList items={laws} />
          </Section>
          <Section title="Нөөц / хэрэгсэл">
            <Paragraph text={description.resources} />
          </Section>
          <Section title="Харилцааны хамрах хүрээ">
            <Paragraph text={communication} />
          </Section>
        </div>
      ) : description.markdown_body ? (
        <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
          {description.markdown_body}
        </pre>
      ) : (
        <p className="text-sm text-slate-500">Ажлын байрны тодорхойлолт хоосон.</p>
      )}

      {hasStructured && description.markdown_body ? (
        <details className="rounded border border-slate-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Бүрэн markdown эх файл
          </summary>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap border-t border-slate-100 p-3 text-xs leading-relaxed text-slate-700">
            {description.markdown_body}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
