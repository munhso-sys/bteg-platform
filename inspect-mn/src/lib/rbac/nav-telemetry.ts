/**
 * NAV-G1 navigation telemetry (Wave N5).
 *
 * Canonical copy: inspect-mn/src/lib/rbac/nav-telemetry.ts
 * Mirrored byte-for-byte into each module app (src/lib/access/nav-telemetry.ts);
 * inspect-mn `nav-authorize.n2.test.ts` fails when a copy drifts.
 *
 * SAFETY: only an allowlisted set of short string/boolean fields is ever
 * emitted. Tokens, cookies, secrets and query strings are NEVER logged — the
 * path is stripped of `?query` / `#hash` (nav/embed tokens travel in query).
 * Edge-runtime safe (no node imports).
 */

export type NavTelemetryEvent =
  | "nav.allow"
  | "nav.deny"
  | "nav.config_missing"
  | "nav.token_invalid"
  | "nav.token_expired"
  | "nav.route_unmapped"
  | "nav.compat_allow";

export type NavTelemetryFields = {
  moduleId?: string;
  path?: string;
  menuId?: string;
  submenuId?: string;
  reason?: string;
  source?: string;
  catalogVersion?: string;
  /** Whether NAV_G1_ENFORCE was on when the decision was made. */
  g1?: boolean;
};

export type NavTelemetryRecord = {
  event: NavTelemetryEvent;
  ts: number;
} & NavTelemetryFields;

export type NavTelemetrySink = (record: NavTelemetryRecord) => void;

let activeSink: NavTelemetrySink | null = null;

/** Replace the sink (tests / metrics adapters). Pass null to restore default. */
export function setNavTelemetrySink(sink: NavTelemetrySink | null): void {
  activeSink = sink;
}

const MAX_FIELD_LEN = 200;

function cap(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return value.length > MAX_FIELD_LEN ? value.slice(0, MAX_FIELD_LEN) : value;
}

/** Drop query string + fragment so nav/embed tokens can never leak via path. */
export function safeNavPath(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const bare = raw.split("?")[0]!.split("#")[0]!;
  return cap(bare);
}

function sanitize(fields: NavTelemetryFields): NavTelemetryFields {
  const out: NavTelemetryFields = {};
  const moduleId = cap(fields.moduleId);
  const menuId = cap(fields.menuId);
  const submenuId = cap(fields.submenuId);
  const reason = cap(fields.reason);
  const source = cap(fields.source);
  const catalogVersion = cap(fields.catalogVersion);
  const path = safeNavPath(fields.path);
  if (moduleId) out.moduleId = moduleId;
  if (path) out.path = path;
  if (menuId) out.menuId = menuId;
  if (submenuId) out.submenuId = submenuId;
  if (reason) out.reason = reason;
  if (source) out.source = source;
  if (catalogVersion) out.catalogVersion = catalogVersion;
  if (typeof fields.g1 === "boolean") out.g1 = fields.g1;
  return out;
}

const COMPAT_LOG_INTERVAL_MS = 60_000;
const lastCompatLog = new Map<string, number>();

function verbose(): boolean {
  return typeof process !== "undefined" && process.env.NAV_TELEMETRY_VERBOSE === "1";
}

function defaultSink(record: NavTelemetryRecord): void {
  // `nav.allow` is high-volume: opt in with NAV_TELEMETRY_VERBOSE=1.
  if (record.event === "nav.allow" && !verbose()) return;
  // `nav.compat_allow` marks pre-G1 traffic: log at most once/min per module.
  if (record.event === "nav.compat_allow" && !verbose()) {
    const key = record.moduleId ?? "?";
    const last = lastCompatLog.get(key) ?? 0;
    if (record.ts - last < COMPAT_LOG_INTERVAL_MS) return;
    lastCompatLog.set(key, record.ts);
  }
  const line = `[nav-telemetry] ${JSON.stringify(record)}`;
  if (record.event === "nav.allow" || record.event === "nav.compat_allow") {
    console.info(line);
  } else {
    console.warn(line);
  }
}

/** Fire-and-forget; never throws and never blocks navigation decisions. */
export function emitNavEvent(
  event: NavTelemetryEvent,
  fields: NavTelemetryFields = {},
): void {
  try {
    const record: NavTelemetryRecord = {
      event,
      ts: Date.now(),
      ...sanitize(fields),
    };
    (activeSink ?? defaultSink)(record);
  } catch {
    // telemetry must never affect authorization
  }
}
