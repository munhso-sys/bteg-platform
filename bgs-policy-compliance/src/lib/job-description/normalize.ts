import type {
  JobDescription,
  JobDescriptionSkillCategory,
} from "@/lib/types";

export function asTextList(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((line) => line.replace(/^\d+[.)]\s*/, "").replace(/^[-•–—]\s*/, "").trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) {
    const s = String(value).trim();
    return s ? [s] : [];
  }
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (typeof o.text === "string") return o.text.trim();
        if (typeof o.name === "string") return o.name.trim();
        if (typeof o.title === "string" && !("items" in o)) return o.title.trim();
      }
      return String(item ?? "").trim();
    })
    .map((line) => line.replace(/^\d+[.)]\s*/, "").replace(/^[-•–—]\s*/, "").trim())
    .filter(Boolean);
}

export function isSkillCategory(value: unknown): value is JobDescriptionSkillCategory {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as JobDescriptionSkillCategory).title === "string" &&
    Array.isArray((value as JobDescriptionSkillCategory).items)
  );
}

export function asSkillCategories(value: unknown): JobDescriptionSkillCategory[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  if (value.every(isSkillCategory)) {
    return value.map((c) => ({
      title: c.title.trim(),
      items: asTextList(c.items),
    }));
  }
  // Legacy flat string list → one category
  const flat = asTextList(value);
  if (!flat.length) return [];
  return [{ title: "Мэргэжлийн ур чадвар", items: flat }];
}

export function defaultSkillCategories(): JobDescriptionSkillCategory[] {
  return [
    { title: "Дүн шинжилгээ хийх", items: [""] },
    { title: "Асуудал шийдвэрлэх", items: [""] },
    { title: "Багаар ажиллах", items: [""] },
  ];
}

export type JdCommunication = {
  internal: string;
  external: string;
};

export function asCommunication(value: unknown): JdCommunication {
  if (value == null) return { internal: "", external: "" };
  if (typeof value === "string") {
    const internalMatch = value.match(
      /компани\s*дотор\s*[:：]?\s*([\s\S]*?)(?=гадна\s*[:：]|$)/i,
    );
    const externalMatch = value.match(/гадна\s*[:：]?\s*([\s\S]*)$/i);
    return {
      internal: (internalMatch?.[1] ?? value).trim(),
      external: (externalMatch?.[1] ?? "").trim(),
    };
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const internalRaw = o.company_internal ?? o.internal ?? o.internal_text;
    const externalRaw = o.external ?? o.external_text ?? o.company_external;
    if (typeof internalRaw === "string" || typeof externalRaw === "string") {
      return {
        internal: typeof internalRaw === "string" ? internalRaw : "",
        external: typeof externalRaw === "string" ? externalRaw : "",
      };
    }
    // Legacy boolean maps → readable labels
    const labelMap = (part: unknown) => {
      if (!part || typeof part !== "object") return "";
      return Object.entries(part as Record<string, unknown>)
        .filter(([, v]) => Boolean(v))
        .map(([k]) => k)
        .join(", ");
    };
    return {
      internal: labelMap(o.company_internal),
      external: labelMap(o.external),
    };
  }
  return { internal: String(value), external: "" };
}

export function documentHeading(jd: Partial<JobDescription> | null | undefined) {
  const unit = (jd?.unit_name ?? "").trim();
  const title = (jd?.title ?? "").trim();
  if (unit && title) return `${unit}-ийн ${title}`.toUpperCase();
  if (title) return `${title}-ын албан тушаалын тодорхойлолт`.toUpperCase();
  return "АЛБАН ТУШААЛЫН ТОДОРХОЙЛОЛТ";
}

export const JD_DEFAULT_COMPANY = '"Болдтөмөр Ерөө Гол" ХХК';
export const JD_DEFAULT_LOCATION =
  "Сэлэнгэ аймаг, Ерөө сум, 2-р баг, Баянгол уурхай";
