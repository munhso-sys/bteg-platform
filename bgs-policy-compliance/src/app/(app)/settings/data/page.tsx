import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PolicyDataResetClient,
  type PolicyDataSection,
} from "@/components/settings/PolicyDataResetClient";
import { PageHeader } from "@/components/ui/primitives";
import {
  assertPolicyAdminAccess,
  getPolicyScope,
  isPolicyAdmin,
} from "@/lib/access/scope";
import {
  clearAllPolicyOrgOverrides,
  clearAllPositionOrgOverrides,
  countPolicyOrgOverrides,
  countPositionOrgOverrides,
  loadPolicyOrgOverridesForExport,
  loadPositionOrgOverridesForExport,
  replaceAllPolicyOrgOverrides,
  replaceAllPositionOrgOverrides,
} from "@/lib/db/org";

export const dynamic = "force-dynamic";

const SECTIONS: PolicyDataSection[] = ["policyOrg", "positionOrg"];

function parseSections(formData: FormData): PolicyDataSection[] {
  const picked = formData
    .getAll("section")
    .map(String)
    .filter((id): id is PolicyDataSection =>
      (SECTIONS as string[]).includes(id),
    );
  return [...new Set(picked)];
}

function revalidateDataPaths() {
  revalidatePath("/settings/data");
  revalidatePath("/settings/org-policies");
  revalidatePath("/org");
  revalidatePath("/policies");
  revalidatePath("/positions");
}

async function clearAction(formData: FormData) {
  "use server";
  try {
    await assertPolicyAdminAccess();
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

  const cleared: string[] = [];
  if (sections.includes("policyOrg")) {
    const n = await countPolicyOrgOverrides();
    await clearAllPolicyOrgOverrides();
    cleared.push(`policyOrg: ${n}`);
  }
  if (sections.includes("positionOrg")) {
    const n = await countPositionOrgOverrides();
    await clearAllPositionOrgOverrides();
    cleared.push(`positionOrg: ${n}`);
  }

  revalidateDataPaths();

  return {
    ok: true as const,
    message: `Устгалаа · ${cleared.join(", ")}`,
  };
}

async function exportAction(formData: FormData) {
  "use server";
  try {
    await assertPolicyAdminAccess();
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

  const exportedAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    exportedAt,
    app: "bgs-policy-compliance",
    sections,
  };

  if (sections.includes("policyOrg")) {
    payload.policyOrgOverrides = await loadPolicyOrgOverridesForExport();
  }
  if (sections.includes("positionOrg")) {
    payload.positionOrgOverrides = await loadPositionOrgOverridesForExport();
  }

  const stamp = exportedAt.replace(/[:.]/g, "-");
  return {
    ok: true as const,
    filename: `policy-compliance-data-${stamp}.json`,
    json: JSON.stringify(payload, null, 2),
  };
}

async function importAction(formData: FormData) {
  "use server";
  try {
    await assertPolicyAdminAccess();
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

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ok: false as const, error: "JSON задлахад алдаа гарлаа." };
  }

  if (payload.app != null && payload.app !== "bgs-policy-compliance") {
    return {
      ok: false as const,
      error: `Энэ файл policy-compliance-ийн нөөц биш (app=${String(payload.app)}).`,
    };
  }

  try {
    const restored: string[] = [];
    if (sections.includes("policyOrg")) {
      if (!("policyOrgOverrides" in payload)) {
        return {
          ok: false as const,
          error: "Файлаас policyOrgOverrides олдсонгүй.",
        };
      }
      const n = await replaceAllPolicyOrgOverrides(payload.policyOrgOverrides);
      restored.push(`policyOrg: ${n}`);
    }
    if (sections.includes("positionOrg")) {
      if (!("positionOrgOverrides" in payload)) {
        return {
          ok: false as const,
          error: "Файлаас positionOrgOverrides олдсонгүй.",
        };
      }
      const n = await replaceAllPositionOrgOverrides(
        payload.positionOrgOverrides,
      );
      restored.push(`positionOrg: ${n}`);
    }

    revalidateDataPaths();
    return {
      ok: true as const,
      message: `Сэргээлээ · ${restored.join(", ")}`,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Сэргээхэд алдаа",
    };
  }
}

export default async function PolicySettingsDataPage() {
  const scope = await getPolicyScope();
  if (!isPolicyAdmin(scope)) {
    redirect("/settings");
  }

  const [policyOrg, positionOrg] = await Promise.all([
    countPolicyOrgOverrides(),
    countPositionOrgOverrides(),
  ]);

  return (
    <div>
      <PageHeader
        title="Өгөгдөл"
        description="Org холболтын гараар хийсэн засварыг JSON-оор нөөцлөх, сэргээх, цэвэрлэх. Үндсэн журам/ажлын байрны каталог үлдэнэ."
      />
      <PolicyDataResetClient
        clearAction={clearAction}
        exportAction={exportAction}
        importAction={importAction}
        counts={{ policyOrg, positionOrg }}
      />
    </div>
  );
}
