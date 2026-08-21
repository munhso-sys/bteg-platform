import { ModuleEmbed } from "@/components/modules/ModuleEmbed";
import { getDutyModuleApps, type DutyModuleId } from "@/lib/module-apps";
import { buildPolicyEmbedOptions } from "@/lib/policy-embed-server";
import { buildInspectionEmbedOptions } from "@/lib/inspection-embed-server";

export async function DutyModulePage({ id }: { id: DutyModuleId }) {
  const app = getDutyModuleApps()[id];

  let entryPath: string | undefined;
  let query: Record<string, string> | undefined;

  try {
    if (id === "policy-compliance") {
      const policyEmbed = await buildPolicyEmbedOptions();
      entryPath = policyEmbed?.entryPath;
      query = policyEmbed?.query;
    } else if (id === "inspection") {
      const inspectionEmbed = await buildInspectionEmbedOptions();
      entryPath = inspectionEmbed?.entryPath;
      query = inspectionEmbed?.query;
    }
  } catch (error) {
    console.error(`[duty-module] embed options failed for ${id}`, error);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ModuleEmbed app={app} entryPath={entryPath} query={query} />
    </div>
  );
}
