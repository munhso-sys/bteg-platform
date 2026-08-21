import { promises as fs } from "fs";
import path from "path";
import { loadAppDataPayload } from "@/lib/risk/store-payload";
import type { AiResolvedScope } from "@/lib/ai/resolve-scope";
import { getDutyModuleApps } from "@/lib/module-apps";
import type {
  ExtractedDocument,
  PolicyOrganization,
  ReviewChunk,
  StoredPolicySummary,
} from "./types";

type Policy = {
  id: string;
  name?: string | null;
  reference_code?: string | null;
  status?: string | null;
  is_deleted?: boolean;
};

type Clause = {
  id: string;
  policy_id: string;
  reference_number?: string | null;
  text?: string | null;
  is_deleted?: boolean;
};

type PolicyDb = { policies?: Policy[]; policy_clauses?: Clause[] };
type OrgRef = { type: "heltes" | "alba"; id: string };
type Overrides = Record<string, { orgs: OrgRef[] | null }>;
type OrgCatalog = {
  heltes: Array<{
    id: string;
    name: string;
    albas: Array<{ id: string; name: string; heltes_id?: string }>;
  }>;
};

type LoadedStore = {
  db: PolicyDb;
  overrides: Overrides;
  organizations: Map<string, PolicyOrganization>;
  source: "app-data-store" | "policy-api";
};

async function loadOrgCatalog() {
  const file = path.join(process.cwd(), "data", "reference", "org-catalog.json");
  const catalog = JSON.parse(await fs.readFile(file, "utf8")) as OrgCatalog;
  const organizations = new Map<string, PolicyOrganization>();
  for (const heltes of catalog.heltes ?? []) {
    organizations.set(heltes.id, {
      type: "heltes",
      id: heltes.id,
      name: heltes.name,
      heltesId: heltes.id,
      heltesName: heltes.name,
    });
    for (const alba of heltes.albas ?? []) {
      organizations.set(alba.id, {
        type: "alba",
        id: alba.id,
        name: alba.name,
        heltesId: alba.heltes_id ?? heltes.id,
        heltesName: heltes.name,
      });
    }
  }
  return organizations;
}

async function loadStoredPolicyData(): Promise<LoadedStore> {
  const organizations = await loadOrgCatalog();

  // The Policy Compliance module owns policy-to-unit assignments. Always use
  // its API as the canonical source so Policy Review mirrors that module's
  // current production configuration. The portal app_data_store snapshot is
  // retained only as an outage fallback because it can lag behind the module.
  try {
    const origin = getDutyModuleApps()["policy-compliance"].origin;
    const response = await fetch(`${origin}/api/org/policy-allocations`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Policy API ${response.status}`);
    const remote = (await response.json()) as {
      ok?: boolean;
      policies?: Policy[];
      allocations?: Array<{
        heltesId: string;
        albaId: string;
        policies?: Array<{ id: string }>;
      }>;
    };
    if (!remote.ok || !Array.isArray(remote.policies)) {
      throw new Error("Policy API response invalid");
    }
    const remoteOverrides: Overrides = {};
    for (const allocation of remote.allocations ?? []) {
      for (const policy of allocation.policies ?? []) {
        const current = remoteOverrides[policy.id]?.orgs ?? [];
        const org: OrgRef = allocation.albaId.endsWith("::heltes-common")
          ? { type: "heltes", id: allocation.heltesId }
          : { type: "alba", id: allocation.albaId };
        if (!current.some((item) => item.type === org.type && item.id === org.id)) {
          current.push(org);
        }
        remoteOverrides[policy.id] = { orgs: current };
      }
    }
    return {
      db: { policies: remote.policies, policy_clauses: [] },
      overrides: remoteOverrides,
      organizations,
      source: "policy-api",
    };
  } catch (error) {
    console.warn(
      "[policy-review] canonical policy API unavailable; using app_data_store fallback",
      error instanceof Error ? error.message : error,
    );
  }

  const [db, overrides] = await Promise.all([
    loadAppDataPayload<PolicyDb>("policy_compliance_db"),
    loadAppDataPayload<Overrides>("policy_compliance_policy_org_overrides"),
  ]);
  if (!db) throw new Error("Журмын дотоод сангийн мэдээлэл олдсонгүй.");
  return {
    db,
    overrides: overrides ?? {},
    organizations,
    source: "app-data-store",
  };
}

function isAccessible(policyId: string, scope: AiResolvedScope, overrides: Overrides) {
  if (scope.mode === "all") return true;
  if (scope.mode === "none" || !scope.unitScope.active) return false;
  const orgs = overrides[policyId]?.orgs;
  if (!orgs) return false;
  return orgs.some(
    (org) =>
      (org.type === "heltes" && org.id === scope.unitScope.heltesId) ||
      (org.type === "alba" && org.id === scope.unitScope.albaId),
  );
}

function resolveOrganizations(
  policyId: string,
  overrides: Overrides,
  catalog: Map<string, PolicyOrganization>,
) {
  const override = overrides[policyId];
  const orgs = override?.orgs;
  if (!Array.isArray(orgs)) return [];
  return orgs.map((org) =>
    catalog.get(org.id) ?? {
      type: org.type,
      id: org.id,
      name: org.id,
      heltesId: org.type === "heltes" ? org.id : null,
      heltesName: null,
    },
  );
}

export async function listAccessibleStoredPolicies(scope: AiResolvedScope) {
  const store = await loadStoredPolicyData();
  const clauses = (store.db.policy_clauses ?? []).filter(
    (clause) => !clause.is_deleted && Boolean(clause.text?.trim()),
  );
  const counts = new Map<string, number>();
  for (const clause of clauses) {
    counts.set(clause.policy_id, (counts.get(clause.policy_id) ?? 0) + 1);
  }

  const policies: StoredPolicySummary[] = (store.db.policies ?? [])
    .filter(
      (policy) =>
        !policy.is_deleted &&
        (store.source === "policy-api" || (counts.get(policy.id) ?? 0) > 0) &&
        isAccessible(policy.id, scope, store.overrides),
    )
    .map<StoredPolicySummary>((policy) => {
      const organizations = resolveOrganizations(
        policy.id,
        store.overrides,
        store.organizations,
      );
      const rawScope = store.overrides[policy.id]?.orgs;
      return {
        id: policy.id,
        name: policy.name?.trim() || policy.id,
        referenceCode: policy.reference_code?.trim() || null,
        status: policy.status?.trim() || null,
        clauseCount:
          store.source === "policy-api" ? null : (counts.get(policy.id) ?? 0),
        organizations,
        organizationScope:
          rawScope === null
            ? "all"
            : organizations.length > 0
              ? "assigned"
              : "unassigned",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "mn"));

  return { policies, store };
}

async function loadPolicyApiClauses(policyId: string): Promise<Clause[]> {
  const origin = getDutyModuleApps()["policy-compliance"].origin;
  const response = await fetch(`${origin}/api/policies/${encodeURIComponent(policyId)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Сонгосон журмын заалтуудыг уншиж чадсангүй.");
  const detail = (await response.json()) as {
    ok?: boolean;
    sections?: Array<{
      clauses?: Array<{
        id: string;
        reference_number?: string | null;
        text?: string | null;
      }>;
    }>;
  };
  if (!detail.ok) throw new Error("Сонгосон журмын заалтуудыг уншиж чадсангүй.");
  return (detail.sections ?? []).flatMap((section) =>
    (section.clauses ?? []).map((clause) => ({
      ...clause,
      policy_id: policyId,
      is_deleted: false,
    })),
  );
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function loadStoredPoliciesForComparison(
  policyIds: string[],
  scope: AiResolvedScope,
) {
  const uniqueIds = [...new Set(policyIds.map((id) => id.trim()).filter(Boolean))];
  const { policies, store } = await listAccessibleStoredPolicies(scope);
  const allowed = new Map(policies.map((policy) => [policy.id, policy]));
  const denied = uniqueIds.find((id) => !allowed.has(id));
  if (denied) throw new Error("Сонгосон журмын аль нэгийг харах эрхгүй эсвэл олдсонгүй.");

  const documents: ExtractedDocument[] = [];
  const chunks: ReviewChunk[] = [];
  for (const policyId of uniqueIds) {
    const summary = allowed.get(policyId)!;
    const sourceClauses =
      store.source === "policy-api"
        ? await loadPolicyApiClauses(policyId)
        : (store.db.policy_clauses ?? []);
    const clauses = sourceClauses.filter(
      (clause) => clause.policy_id === policyId && !clause.is_deleted && Boolean(clause.text?.trim()),
    );
    if (clauses.length === 0) {
      throw new Error(`${summary.name}: харьцуулах заалт олдсонгүй.`);
    }
    const documentId = `stored-policy-${policyId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const name = [summary.referenceCode, summary.name].filter(Boolean).join(" · ");
    const text = clauses
      .map((clause) => `${clause.reference_number ?? "Заалт"}\n${clean(clause.text ?? "")}`)
      .join("\n\n");
    documents.push({
      id: documentId,
      name,
      mimeType: "application/x-inspect-policy",
      pages: [{ page: null, text }],
      characterCount: text.length,
      warnings: [],
    });
    clauses.slice(0, 180).forEach((clause, index) => {
      chunks.push({
        id: `${documentId}-clause-${index + 1}`,
        documentId,
        documentName: name,
        index: index + 1,
        page: null,
        section: clause.reference_number?.trim() || null,
        text: clean(clause.text ?? ""),
      });
    });
  }
  return { documents, chunks };
}
