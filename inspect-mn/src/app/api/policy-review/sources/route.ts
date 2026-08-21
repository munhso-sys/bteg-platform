import { NextResponse } from "next/server";
import { requireAiAccess } from "@/lib/ai/access";
import { readAiScopeConfig } from "@/lib/ai/scope-config-store";
import { resolveAiDataScope } from "@/lib/ai/resolve-scope";
import { listAccessibleStoredPolicies } from "@/lib/policy-review/stored-policies";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAiAccess();
  if (access.error) return access.error;
  try {
    const config = await readAiScopeConfig();
    const scope = resolveAiDataScope(access.profile, access.roleId, config);
    if (!scope.sources.includes("policy_content")) {
      return NextResponse.json(
        { ok: false, error: "Журмын агуулгын AI мэдээллийн эх үүсвэр хаалттай байна." },
        { status: 403 },
      );
    }
    const { policies } = await listAccessibleStoredPolicies(scope);
    return NextResponse.json({ ok: true, policies, scopeNote: scope.scopeNote });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Журмын жагсаалт уншихад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
