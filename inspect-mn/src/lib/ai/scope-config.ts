import type { RoleId } from "@/lib/rbac/types";

export const AI_SCOPE_CONFIG_KEY = "platform_ai_data_scope";

/** Platforms data sources the AI may read. */
export type AiDataSource =
  | "policy"
  | "policy_content"
  | "inspection"
  | "inspection_detail"
  | "development"
  | "guidance"
  | "voice"
  | "risk"
  | "reports"
  | "smartmine"
  | "people";

export type AiScopeMode = "all" | "unit" | "none";

export const AI_DATA_SOURCES: AiDataSource[] = [
  "policy",
  "policy_content",
  "inspection",
  "inspection_detail",
  "development",
  "guidance",
  "voice",
  "risk",
  "reports",
  "smartmine",
  "people",
];

export const AI_SOURCE_LABELS: Record<AiDataSource, string> = {
  policy: "Журмын биелэлт (тоо/KPI)",
  policy_content: "Журмын агуулга (заалтын текст · хайлт)",
  inspection: "Хяналт шалгалт (тоо/KPI)",
  inspection_detail: "Шалгалтын олдвор/дүгнэлт (хайлт)",
  development: "Судалгаа хөгжүүлэлт",
  guidance: "Удирдамж (захиалга · гүйцэтгэл)",
  voice: "Ажилтны дуу хоолой",
  risk: "Эрсдэлийн дохио",
  reports: "Тайлан / KPI нэгтгэл",
  smartmine: "SmartMine (боловсруулалт · засвар · тоног төхөөрөмж)",
  people: "Хэрэглэгч / хүний нөөц",
};

export const AI_ROLE_OPTIONS: Array<{ id: RoleId; label: string }> = [
  { id: "admin", label: "Админ" },
  { id: "leadership", label: "Удирдлага" },
  { id: "dxsh_head", label: "ДХШХ дарга" },
  { id: "dxsh_specialist", label: "ДХШХ мэргэжилтэн" },
  { id: "unit_manager", label: "Нэгжийн менежер" },
  { id: "senior_specialist", label: "Ахлах мэргэжилтэн" },
  { id: "specialist", label: "Мэргэжилтэн" },
  { id: "junior_specialist", label: "Дэд мэргэжилтэн" },
  { id: "employee", label: "Ажилтан" },
  { id: "assistant", label: "Туслах" },
];

export type AiScopeConfig = {
  version: 1;
  updatedAt: string;
  /**
   * Roles that may query platform-wide data (all heltes/alba).
   * Admin is always included even if removed from the list.
   */
  fullAccessRoles: RoleId[];
  /**
   * Roles forced to heltes/alba scope when they have an org assignment.
   * Without assignment they get no unit-bound facts.
   */
  unitScopedRoles: RoleId[];
  /** Globally enabled data sources for the AI. */
  sources: Record<AiDataSource, boolean>;
};

export const DEFAULT_AI_SCOPE_CONFIG: AiScopeConfig = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  fullAccessRoles: ["admin", "leadership", "dxsh_head", "dxsh_specialist"],
  unitScopedRoles: [
    "unit_manager",
    "senior_specialist",
    "specialist",
    "junior_specialist",
    "employee",
    "assistant",
  ],
  sources: {
    policy: true,
    policy_content: true,
    inspection: true,
    inspection_detail: true,
    development: true,
    guidance: true,
    voice: true,
    risk: true,
    reports: true,
    smartmine: true,
    people: true,
  },
};

function asRoleList(value: unknown, fallback: RoleId[]): RoleId[] {
  if (!Array.isArray(value)) return [...fallback];
  const known = new Set(AI_ROLE_OPTIONS.map((r) => r.id));
  const out: RoleId[] = [];
  for (const item of value) {
    if (typeof item === "string" && known.has(item as RoleId)) {
      out.push(item as RoleId);
    }
  }
  return out.length ? out : [...fallback];
}

export function normalizeAiScopeConfig(raw: unknown): AiScopeConfig {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sourcesRaw =
    obj.sources && typeof obj.sources === "object"
      ? (obj.sources as Record<string, unknown>)
      : {};
  const sources = { ...DEFAULT_AI_SCOPE_CONFIG.sources };
  for (const key of AI_DATA_SOURCES) {
    if (typeof sourcesRaw[key] === "boolean") {
      sources[key] = sourcesRaw[key] as boolean;
    }
  }

  const fullAccessRoles = asRoleList(
    obj.fullAccessRoles,
    DEFAULT_AI_SCOPE_CONFIG.fullAccessRoles,
  );
  if (!fullAccessRoles.includes("admin")) {
    fullAccessRoles.unshift("admin");
  }

  return {
    version: 1,
    updatedAt:
      typeof obj.updatedAt === "string" && obj.updatedAt
        ? obj.updatedAt
        : new Date().toISOString(),
    fullAccessRoles,
    unitScopedRoles: asRoleList(
      obj.unitScopedRoles,
      DEFAULT_AI_SCOPE_CONFIG.unitScopedRoles,
    ),
    sources,
  };
}

export function enabledAiSources(config: AiScopeConfig): AiDataSource[] {
  return AI_DATA_SOURCES.filter((s) => config.sources[s]);
}
