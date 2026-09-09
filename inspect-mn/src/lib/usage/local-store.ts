/**
 * LOCAL-SAFE usage event store.
 * Writes only to inspect-mn/data/usage/events.jsonl (gitignored).
 * Never writes to Production Supabase / app_data_store.
 */
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { UsageEvent, UsageEventKind, UsageTreeNode } from "./types";

const MAX_EVENTS = 5000;

function usageDir() {
  return path.join(process.cwd(), "data", "usage");
}

function eventsPath() {
  return path.join(usageDir(), "events.jsonl");
}

export async function appendUsageEvent(
  partial: Omit<UsageEvent, "id" | "at"> & { at?: string; id?: string },
): Promise<UsageEvent> {
  const event: UsageEvent = {
    id: partial.id ?? randomUUID(),
    at: partial.at ?? new Date().toISOString(),
    kind: partial.kind,
    userId: partial.userId ?? null,
    email: partial.email ?? null,
    fullName: partial.fullName ?? null,
    heltesId: partial.heltesId ?? null,
    heltesName: partial.heltesName ?? null,
    albaId: partial.albaId ?? null,
    albaName: partial.albaName ?? null,
    positionId: partial.positionId ?? null,
    positionName: partial.positionName ?? null,
    roleId: partial.roleId ?? null,
    module: partial.module ?? null,
    path: partial.path ?? null,
    model: partial.model ?? null,
    promptTokens: partial.promptTokens ?? null,
    completionTokens: partial.completionTokens ?? null,
    totalTokens: partial.totalTokens ?? null,
    detail: partial.detail ?? null,
  };

  await fs.mkdir(usageDir(), { recursive: true });
  await fs.appendFile(eventsPath(), `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

export async function readUsageEvents(limit = 2000): Promise<UsageEvent[]> {
  try {
    const raw = await fs.readFile(eventsPath(), "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const sliced = lines.slice(-Math.min(limit, MAX_EVENTS));
    const out: UsageEvent[] = [];
    for (const line of sliced) {
      try {
        out.push(JSON.parse(line) as UsageEvent);
      } catch {
        // skip corrupt line
      }
    }
    return out;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return [];
    throw error;
  }
}

function bump(
  node: UsageTreeNode,
  event: UsageEvent,
) {
  if (event.kind === "login") node.logins += 1;
  if (event.kind === "module_view") node.moduleViews += 1;
  if (event.kind === "openai") {
    node.openaiCalls += 1;
    node.totalTokens += event.totalTokens ?? 0;
  }
  node.recent.push(event);
  if (node.recent.length > 8) node.recent.shift();
}

export function buildUsageTree(events: UsageEvent[]): UsageTreeNode[] {
  const root = new Map<string, UsageTreeNode>();

  for (const event of events) {
    const heltesKey = event.heltesId || event.heltesName || "_none";
    const heltesLabel = event.heltesName || event.heltesId || "Хэлтэс тодорхойгүй";
    let heltes = root.get(heltesKey);
    if (!heltes) {
      heltes = {
        key: heltesKey,
        label: heltesLabel,
        level: "heltes",
        logins: 0,
        moduleViews: 0,
        openaiCalls: 0,
        totalTokens: 0,
        children: [],
        recent: [],
      };
      root.set(heltesKey, heltes);
    }
    bump(heltes, event);

    const albaKey = `${heltesKey}::${event.albaId || event.albaName || "_none"}`;
    let alba = heltes.children.find((c) => c.key === albaKey);
    if (!alba) {
      alba = {
        key: albaKey,
        label: event.albaName || event.albaId || "Алба тодорхойгүй",
        level: "alba",
        logins: 0,
        moduleViews: 0,
        openaiCalls: 0,
        totalTokens: 0,
        children: [],
        recent: [],
      };
      heltes.children.push(alba);
    }
    bump(alba, event);

    const roleKey = `${albaKey}::${event.roleId || "_none"}`;
    let role = alba.children.find((c) => c.key === roleKey);
    if (!role) {
      role = {
        key: roleKey,
        label: event.roleId || "role тодорхойгүй",
        level: "role",
        logins: 0,
        moduleViews: 0,
        openaiCalls: 0,
        totalTokens: 0,
        children: [],
        recent: [],
      };
      alba.children.push(role);
    }
    bump(role, event);

    const userKey = `${roleKey}::${event.userId || event.email || "_anon"}`;
    let user = role.children.find((c) => c.key === userKey);
    if (!user) {
      user = {
        key: userKey,
        label:
          event.fullName ||
          event.email ||
          event.positionName ||
          event.userId ||
          "Хэрэглэгч",
        level: "user",
        logins: 0,
        moduleViews: 0,
        openaiCalls: 0,
        totalTokens: 0,
        children: [],
        recent: [],
      };
      role.children.push(user);
    }
    bump(user, event);
  }

  return [...root.values()].sort((a, b) => b.totalTokens - a.totalTokens || b.logins - a.logins);
}

export function filterEvents(
  events: UsageEvent[],
  kind?: UsageEventKind | "all",
): UsageEvent[] {
  if (!kind || kind === "all") return events;
  return events.filter((e) => e.kind === kind);
}
