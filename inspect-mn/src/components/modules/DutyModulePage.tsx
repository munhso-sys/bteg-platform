import { ModuleEmbed } from "@/components/modules/ModuleEmbed";
import { getDutyModuleApps, type DutyModuleId } from "@/lib/module-apps";
import { buildPolicyEmbedOptions } from "@/lib/policy-embed-server";
import { buildInspectionEmbedOptions } from "@/lib/inspection-embed-server";
import { buildDevelopmentEmbedOptions } from "@/lib/development-embed-server";
import { buildProcessEmbedOptions } from "@/lib/process-embed-server";
import { assertPortalMenuAccess } from "@/lib/rbac/assert-menu-access";

const DUTY_PORTAL_PATH: Record<DutyModuleId, string> = {
  inspection: "/inspection",
  "policy-compliance": "/policy-compliance",
  development: "/development",
  process: "/process",
};

function PolicyEmbedError({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-base font-medium text-[var(--fg)]">
        Журмын биелэлт ачаалах боломжгүй
      </p>
      <p className="max-w-md text-sm text-[var(--muted)]">{message}</p>
      <a
        href="/policy-compliance"
        className="rounded-md bg-[var(--fg)] px-4 py-2 text-sm text-[var(--bg)]"
      >
        Дахин оролдох
      </a>
    </div>
  );
}

export async function DutyModulePage({ id }: { id: DutyModuleId }) {
  // Portal top-level module allowlist (Role эрх → Портал цэс)
  await assertPortalMenuAccess("portal", DUTY_PORTAL_PATH[id]);

  const app = getDutyModuleApps()[id];

  let entryPath: string | undefined;
  let query: Record<string, string> | undefined;

  try {
    if (id === "policy-compliance") {
      const policyEmbed = await buildPolicyEmbedOptions();
      if (!policyEmbed?.query?.embed) {
        return (
          <PolicyEmbedError message="Portal embed токен үүсгэхэд алдаа гарлаа эсвэл хугацаа хэтэрсэн. Дахин оролдоно уу." />
        );
      }
      entryPath = policyEmbed.entryPath;
      query = policyEmbed.query;
    } else if (id === "inspection") {
      const inspectionEmbed = await buildInspectionEmbedOptions();
      entryPath = inspectionEmbed?.entryPath;
      query = inspectionEmbed?.query;
    } else if (id === "development") {
      const developmentEmbed = await buildDevelopmentEmbedOptions();
      entryPath = developmentEmbed?.entryPath;
      query = developmentEmbed?.query;
    } else if (id === "process") {
      const processEmbed = await buildProcessEmbedOptions();
      entryPath = processEmbed?.entryPath;
      query = processEmbed?.query;
    }
  } catch (error) {
    console.error(`[duty-module] embed options failed for ${id}`, error);
    if (id === "policy-compliance") {
      return (
        <PolicyEmbedError message="Серверийн алдаа. Дахин оролдоно уу." />
      );
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ModuleEmbed app={app} entryPath={entryPath} query={query} />
    </div>
  );
}
