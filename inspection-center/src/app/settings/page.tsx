import { revalidatePath } from "next/cache";
import { revalidateActionsPaths } from "@/app/actions/cache";
import { revalidateFindingsPaths } from "@/app/findings/cache";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/ui/primitives";
import { readStore, setRiskThresholds } from "@/lib/store";
import {
  formatFindingRiskBands,
  formatRunRiskBands,
  normalizeRiskThresholds,
  SEVERITY_LABELS,
} from "@/lib/types";

export const dynamic = "force-dynamic";

async function saveThresholds(formData: FormData) {
  "use server";
  const { assertInspectionWriteAccess } = await import("@/lib/access/scope");
  await assertInspectionWriteAccess();
  setRiskThresholds({
    lowMaxExclusive: Number(formData.get("lowMax")) / 100,
    mediumMaxExclusive: Number(formData.get("mediumMax")) / 100,
    findingMediumMin: Number(formData.get("findingMediumMin")),
    findingHighMin: Number(formData.get("findingHighMin")),
    findingCriticalMin: Number(formData.get("findingCriticalMin")),
    severityBase: {
      low: Number(formData.get("severityLow")),
      medium: Number(formData.get("severityMedium")),
      high: Number(formData.get("severityHigh")),
      critical: Number(formData.get("severityCritical")),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/runs");
  revalidateActionsPaths();
  revalidateFindingsPaths();
}

export default function SettingsPage() {
  const data = readStore();
  const t = normalizeRiskThresholds(data.riskThresholds);
  const runBands = formatRunRiskBands(t);
  const findingBands = formatFindingRiskBands(t);

  return (
    <div>
      <PageHeader
        title="Тохиргоо"
        subtitle="Эрсдэлийн тооцоолол, алба·ХШ хуудас холболт болон интеграци"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Эрсдэлийн тооцоолол">
          <p className="mb-3 text-sm text-[var(--muted)]">
            Эрсдэлийн оноо = max(зөрчлийн ноцтлын суурь оноо, тухайн гүйцэтгэлийн
            эрсдэлийн %). Энэ дүрэм самбар, гүйцэтгэл, засах арга хэмжээ, зөрчлийн
            үзүүлэлтэд нэгэн зэрэг үйлчилнэ.
          </p>

          <form action={saveThresholds} className="space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Гүйцэтгэлийн эрсдэлийн босго
              </h3>
              <p className="mb-2 text-xs text-[var(--muted)]">
                ХШ онооны эрсдэлийн % · {runBands.map((b) => `${b.label} ${b.range}`).join(", ")}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Бага дээд хязгаар (%)</span>
                  <input
                    className="input w-full max-w-[10rem]"
                    name="lowMax"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={Math.round(t.lowMaxExclusive * 100)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Дунд дээд хязгаар (%)</span>
                  <input
                    className="input w-full max-w-[10rem]"
                    name="mediumMax"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={Math.round(t.mediumMaxExclusive * 100)}
                  />
                </label>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Ноцтлын суурь оноо
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    {SEVERITY_LABELS.low} (%)
                  </span>
                  <input
                    className="input w-full max-w-[10rem]"
                    name="severityLow"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={t.severityBase.low}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    {SEVERITY_LABELS.medium} (%)
                  </span>
                  <input
                    className="input w-full max-w-[10rem]"
                    name="severityMedium"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={t.severityBase.medium}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    {SEVERITY_LABELS.high} (%)
                  </span>
                  <input
                    className="input w-full max-w-[10rem]"
                    name="severityHigh"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={t.severityBase.high}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    {SEVERITY_LABELS.critical} (%)
                  </span>
                  <input
                    className="input w-full max-w-[10rem]"
                    name="severityCritical"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={t.severityBase.critical}
                  />
                </label>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Нэгтгэсэн эрсдэлийн ангилал
              </h3>
              <p className="mb-2 text-xs text-[var(--muted)]">
                {findingBands.map((b) => `${b.label} ${b.range}`).join(" · ")}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Дунд эхлэл (%)</span>
                  <input
                    className="input w-full max-w-[10rem]"
                    name="findingMediumMin"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={t.findingMediumMin}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Их эхлэл (%)</span>
                  <input
                    className="input w-full max-w-[10rem]"
                    name="findingHighMin"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={t.findingHighMin}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Маш их эхлэл (%)</span>
                  <input
                    className="input w-full max-w-[10rem]"
                    name="findingCriticalMin"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={t.findingCriticalMin}
                  />
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-primary">
              Хадгалах
            </button>
          </form>
        </Panel>

        <Panel title="ХШ хуудас · нэгж холболт">
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            <li>
              Алба/хэлтэст ХШ хуудас хувиарлах:{" "}
              <a
                href="/settings/org-templates"
                className="font-medium text-[var(--brand)] hover:underline"
              >
                Алба · ХШ хуудас холбох
              </a>
            </li>
            <li>
              Журам ↔ алба холболтыг Журмын биелэлт модулийн Тохиргооноос хийнэ
            </li>
            <li>
              <code>inspection_findings.policy_clause_id</code> — зөрчлийг
              бодлогын заалттай холбоно
            </li>
            <li>
              Нотлох баримт/засах арга хэмжээг нийцлийн самбарт дамжуулах
              гэрээ:{" "}
              <code>src/lib/integration/policy-compliance.ts</code>
            </li>
            <li>Энэ систем бодлогын CRUD-ийг давтахгүй</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
