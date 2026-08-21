import { readSidebarFindingIndicators } from "@/lib/findings/sidebar-indicators";

export type JointUnitOption = {
  key: string;
  label: string;
};

const FALLBACK_JOINT_UNITS: JointUnitOption[] = [
  { key: "zoa", label: "ЗОА" },
  { key: "boa", label: "БОА" },
  { key: "ata", label: "АТА" },
  { key: "aba", label: "АБА" },
  { key: "ba", label: "БА" },
  { key: "hmmza", label: "ХММЗА" },
  { key: "ttza", label: "ТТЗА" },
  { key: "bh-shts", label: "БХ-ШТС" },
  { key: "is", label: "ИС" },
  { key: "is-hbu", label: "ИС-ХБҮ" },
  { key: "kvk", label: "КВК" },
  { key: "mtl", label: "МТЛ ХХК" },
  { key: "elgen", label: "Элгэн ХХК" },
  { key: "tgd", label: "ТГД ХХК" },
  { key: "mth", label: "МТХ ХХК" },
];

function slugifyUnit(label: string) {
  return label
    .trim()
    .toLocaleLowerCase("mn")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "");
}

export function listJointInspectionUnits(): JointUnitOption[] {
  const indicators = readSidebarFindingIndicators();
  const units = indicators?.sourceSections.joint.units ?? [];
  const fromSheet = units
    .map((row) => row.unit?.trim())
    .filter((label): label is string => Boolean(label))
    .filter((label) => label !== "Нийт")
    .map((label) => ({
      key: slugifyUnit(label) || label,
      label,
    }));

  if (fromSheet.length === 0) return FALLBACK_JOINT_UNITS;

  const seen = new Set<string>();
  return fromSheet.filter((unit) => {
    if (seen.has(unit.key)) return false;
    seen.add(unit.key);
    return true;
  });
}

/** Шөнийн ХШ — зөвхөн 3 байршил */
export const NIGHT_INSPECTION_UNITS: JointUnitOption[] = [
  { key: "zuun", label: "Зүүн" },
  { key: "baruun", label: "Баруун" },
  { key: "handgait", label: "Хандгайт" },
];

export function listNightInspectionUnits(): JointUnitOption[] {
  return NIGHT_INSPECTION_UNITS;
}
