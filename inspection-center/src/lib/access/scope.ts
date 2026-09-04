import { cookies, headers } from "next/headers";
import {
  INSPECTION_EMBED_HEADER,
  INSPECTION_SCOPE_COOKIE,
  isUnitScopedInspection,
  matchesInspectionUnit,
  verifyInspectionEmbedToken,
  type InspectionEmbedClaims,
} from "@/lib/access/embed";
import {
  decideInspectionAdminAccess,
  decideInspectionWriteAccess,
  isInspectionAdminScope,
} from "@/lib/access/write-access";
import { allocationsForUnit } from "@/lib/org-template/store";
import type { OrgTemplateAllocation } from "@/lib/org-template/types";
import { readStore } from "@/lib/store";
import type { InspectionCenterData } from "@/lib/types";

export async function getInspectionScope(): Promise<InspectionEmbedClaims | null> {
  const h = await headers();
  const fromHeader = h.get(INSPECTION_EMBED_HEADER);
  if (fromHeader) {
    const claims = await verifyInspectionEmbedToken(fromHeader);
    if (claims) return claims;
  }

  const jar = await cookies();
  const fromCookie = jar.get(INSPECTION_SCOPE_COOKIE)?.value;
  if (fromCookie) {
    const claims = await verifyInspectionEmbedToken(fromCookie);
    if (claims) return claims;
  }

  // Last resort: embed still present on the request URL (RSC / direct).
  const path = h.get("x-url") || h.get("next-url") || "";
  try {
    const q = path.includes("?")
      ? new URL(path, "http://local.invalid").searchParams.get("embed")
      : null;
    if (q) return verifyInspectionEmbedToken(q);
  } catch {
    // ignore
  }

  return null;
}

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildUnitMatchers(
  scope: InspectionEmbedClaims,
  allocations: OrgTemplateAllocation[],
) {
  const labels = new Set<string>();
  const ids = new Set<string>();
  const templateIds = new Set<string>();

  for (const v of [scope.albaName, scope.heltesName, scope.albaId, scope.heltesId]) {
    const n = normalizeLabel(v);
    if (n) labels.add(n);
  }
  if (scope.albaId) ids.add(scope.albaId);
  if (scope.heltesId) ids.add(scope.heltesId);

  for (const a of allocations) {
    for (const v of [a.albaName, a.heltesName, a.albaId, a.heltesId]) {
      const n = normalizeLabel(v);
      if (n) labels.add(n);
    }
    ids.add(a.albaId);
    ids.add(a.heltesId);
    for (const tid of a.templateIds) templateIds.add(tid);
  }

  return { labels: [...labels], ids, templateIds };
}

function matchesExpanded(
  value: string | null | undefined,
  matchers: { labels: string[]; ids: Set<string> },
) {
  if (!value) return false;
  if (matchers.ids.has(value)) return true;
  const n = normalizeLabel(value);
  if (!n) return false;
  return matchers.labels.some((l) => n.includes(l) || l.includes(n));
}

export async function readScopedStore(): Promise<{
  data: InspectionCenterData;
  scope: InspectionEmbedClaims | null;
  allocations: OrgTemplateAllocation[];
}> {
  const scope = await getInspectionScope();
  const data = readStore();
  if (!isUnitScopedInspection(scope) || !scope) {
    return { data, scope, allocations: [] };
  }

  const allocations = await allocationsForUnit({
    heltesId: scope.heltesId,
    albaId: scope.albaId,
    heltesName: scope.heltesName,
    albaName: scope.albaName,
  });
  const matchers = buildUnitMatchers(scope, allocations);

  // Prefer admin Алба·ХШ холболт: if allocations exist, scope by templateIds.
  // If none configured yet, fall back to org-label matching (legacy).
  const hasTemplateAllocations = matchers.templateIds.size > 0;

  const runs = data.runs.filter((r) => {
    if (hasTemplateAllocations) {
      return r.templateId != null && matchers.templateIds.has(r.templateId);
    }
    return (
      matchesInspectionUnit(r.inspectedByOrg, scope) ||
      matchesInspectionUnit(r.targetOrgUnitId, scope) ||
      matchesInspectionUnit(r.targetDepartmentId, scope) ||
      matchesExpanded(r.inspectedByOrg, matchers) ||
      matchesExpanded(r.targetOrgUnitId, matchers) ||
      matchesExpanded(r.targetDepartmentId, matchers)
    );
  });
  const runIds = new Set(runs.map((r) => r.id));

  const findings = data.findings.filter((f) => {
    if (runIds.has(f.runId)) return true;
    if (hasTemplateAllocations) return false;
    if (
      matchesInspectionUnit(f.targetOrgUnitId, scope) ||
      matchesInspectionUnit(f.targetDepartmentId, scope) ||
      matchesExpanded(f.targetOrgUnitId, matchers) ||
      matchesExpanded(f.targetDepartmentId, matchers)
    ) {
      return true;
    }
    return false;
  });
  const findingIds = new Set(findings.map((f) => f.id));

  const actions = data.actions.filter(
    (a) =>
      findingIds.has(a.findingId) ||
      (!hasTemplateAllocations &&
        (matchesInspectionUnit(a.responsibleOrgUnitId, scope) ||
          matchesExpanded(a.responsibleOrgUnitId, matchers))),
  );

  const plans = data.plans.filter((p) => {
    if (hasTemplateAllocations) {
      // InspectionPlan has no templateId — keep org-linked or unscoped plans out
      // when allocations drive visibility; plans list is secondary for unit users.
      return (
        matchesInspectionUnit(p.targetOrgUnitId, scope) ||
        matchesInspectionUnit(p.targetDepartmentId, scope) ||
        matchesExpanded(p.targetOrgUnitId, matchers) ||
        matchesExpanded(p.targetDepartmentId, matchers)
      );
    }
    return (
      matchesInspectionUnit(p.targetOrgUnitId, scope) ||
      matchesInspectionUnit(p.targetDepartmentId, scope) ||
      matchesExpanded(p.targetOrgUnitId, matchers) ||
      matchesExpanded(p.targetDepartmentId, matchers) ||
      (!p.targetOrgUnitId && !p.targetDepartmentId)
    );
  });

  const templates = hasTemplateAllocations
    ? data.templates.filter((t) => matchers.templateIds.has(t.id))
    : data.templates;

  return {
    scope,
    allocations,
    data: {
      ...data,
      templates,
      runs,
      findings,
      actions,
      plans,
    },
  };
}

/** Template IDs allocated to the current unit (null = not unit-scoped). */
export async function resolveUnitTemplateIds(
  scope?: InspectionEmbedClaims | null,
): Promise<Set<string> | null> {
  const resolved = scope === undefined ? await getInspectionScope() : scope;
  if (!isUnitScopedInspection(resolved) || !resolved) return null;

  const allocations = await allocationsForUnit({
    heltesId: resolved.heltesId,
    albaId: resolved.albaId,
    heltesName: resolved.heltesName,
    albaName: resolved.albaName,
  });
  const ids = new Set<string>();
  for (const a of allocations) {
    for (const tid of a.templateIds) ids.add(tid);
  }
  return ids;
}

/** Block write APIs unless signed non-unit embed (IC-D05 fail-closed). */
export async function requireInspectionWriteAccess() {
  const scope = await getInspectionScope();
  const decision = decideInspectionWriteAccess(scope);
  if (!decision.allow) {
    return {
      error: Response.json(
        { ok: false, error: decision.message },
        { status: decision.status },
      ),
    };
  }
  return { scope };
}

/** For server actions — throws if write not allowed (IC-D05). */
export async function assertInspectionWriteAccess() {
  const scope = await getInspectionScope();
  const decision = decideInspectionWriteAccess(scope);
  if (!decision.allow) {
    throw new Error(decision.message);
  }
  return scope;
}

/** Destructive store ops — Admin role only (fail-closed without scope). */
export async function assertInspectionAdminAccess() {
  const scope = await getInspectionScope();
  const decision = decideInspectionAdminAccess(scope);
  if (!decision.allow) {
    throw new Error(decision.message);
  }
  return scope;
}

export function isInspectionAdmin(
  scope: InspectionEmbedClaims | null | undefined,
) {
  return isInspectionAdminScope(scope);
}

export function isInspectionReadOnly(
  scope: InspectionEmbedClaims | null | undefined,
) {
  return isUnitScopedInspection(scope);
}
