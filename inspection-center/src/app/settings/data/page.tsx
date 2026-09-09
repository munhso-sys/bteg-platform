import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataResetClient } from "@/components/settings/DataResetClient";
import {
  assertInspectionAdminAccess,
  getInspectionScope,
  isInspectionAdmin,
} from "@/lib/access/scope";
import {
  clearInspectionStoreSections,
  exportInspectionStoreSections,
  importInspectionStoreSections,
  readAnnualPlans,
  readAnnualPlanTypeTargets,
  readStore,
  type StoreClearSection,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const SECTIONS: StoreClearSection[] = [
  "execution",
  "legacyPlans",
  "annualPlans",
  "annualPlanTypes",
];

function sectionCounts() {
  const data = readStore();
  return {
    execution:
      data.runs.length +
      data.answers.length +
      data.findings.length +
      data.actions.length +
      data.evidence.length +
      data.scoreSnapshots.length,
    legacyPlans: data.plans.length,
    annualPlans: readAnnualPlans().length,
    annualPlanTypes: readAnnualPlanTypeTargets().length,
  };
}

function parseSections(formData: FormData): StoreClearSection[] {
  const picked = formData
    .getAll("section")
    .map(String)
    .filter((id): id is StoreClearSection =>
      (SECTIONS as string[]).includes(id),
    );
  return [...new Set(picked)];
}

function revalidateDataPaths() {
  revalidatePath("/settings/data");
  revalidatePath("/dashboard");
  revalidatePath("/runs");
  revalidatePath("/findings");
  revalidatePath("/actions");
  revalidatePath("/plans");
}

async function clearAction(formData: FormData) {
  "use server";
  try {
    await assertInspectionAdminAccess();
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Эрх хүрэлцэхгүй",
    };
  }

  if (String(formData.get("confirm") ?? "").trim() !== "УСТГАХ") {
    return { ok: false as const, error: "Баталгаажуулах үг буруу байна." };
  }

  const sections = parseSections(formData);
  if (sections.length === 0) {
    return { ok: false as const, error: "Хэсэг сонгоогүй байна." };
  }

  const result = clearInspectionStoreSections(sections);
  revalidateDataPaths();

  const parts = result.cleared.map(
    (id) => `${id}: ${result.counts[id] ?? 0}`,
  );
  return {
    ok: true as const,
    message: `Устгалаа · ${parts.join(", ")}`,
  };
}

async function exportAction(formData: FormData) {
  "use server";
  try {
    await assertInspectionAdminAccess();
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Эрх хүрэлцэхгүй",
    };
  }

  const sections = parseSections(formData);
  if (sections.length === 0) {
    return { ok: false as const, error: "Хэсэг сонгоогүй байна." };
  }

  const payload = exportInspectionStoreSections(sections);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    ok: true as const,
    filename: `inspection-center-data-${stamp}.json`,
    json: JSON.stringify(payload, null, 2),
  };
}

async function importAction(formData: FormData) {
  "use server";
  try {
    await assertInspectionAdminAccess();
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Эрх хүрэлцэхгүй",
    };
  }

  if (String(formData.get("confirm") ?? "").trim() !== "СЭРГЭЭХ") {
    return { ok: false as const, error: "Баталгаажуулах үг буруу байна." };
  }

  const sections = parseSections(formData);
  if (sections.length === 0) {
    return { ok: false as const, error: "Хэсэг сонгоогүй байна." };
  }

  const raw = String(formData.get("json") ?? "");
  if (!raw.trim()) {
    return { ok: false as const, error: "JSON файл хоосон байна." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false as const, error: "JSON задлахад алдаа гарлаа." };
  }

  try {
    const result = importInspectionStoreSections(payload, sections);
    revalidateDataPaths();
    const parts = result.cleared.map(
      (id) => `${id}: ${result.counts[id] ?? 0}`,
    );
    return {
      ok: true as const,
      message: `Сэргээлээ · ${parts.join(", ")}`,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Сэргээхэд алдаа",
    };
  }
}

export default async function InspectionSettingsDataPage() {
  const scope = await getInspectionScope();
  if (!isInspectionAdmin(scope)) {
    redirect("/settings");
  }

  return (
    <div>
      <PageHeader
        title="Өгөгдөл"
        subtitle="Шалгалтын гүйцэтгэл / төлөвлөгөөний өгөгдлийг JSON-оор нөөцлөх, сэргээх, сонгосон хэсгийг цэвэрлэх. Template · master · алба холболт үлдэнэ."
      />
      <DataResetClient
        clearAction={clearAction}
        exportAction={exportAction}
        importAction={importAction}
        counts={sectionCounts()}
      />
    </div>
  );
}
