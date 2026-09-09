/** Local usage / login analytics events (portal). */

export type UsageEventKind = "login" | "module_view" | "openai";

export type UsageEvent = {
  id: string;
  kind: UsageEventKind;
  at: string;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  heltesId: string | null;
  heltesName: string | null;
  albaId: string | null;
  albaName: string | null;
  positionId: string | null;
  positionName: string | null;
  roleId: string | null;
  /** Module id, path, or AI module key */
  module: string | null;
  path: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  detail: string | null;
};

export type UsageTreeNode = {
  key: string;
  label: string;
  level: "heltes" | "alba" | "role" | "user";
  logins: number;
  moduleViews: number;
  openaiCalls: number;
  totalTokens: number;
  children: UsageTreeNode[];
  recent: UsageEvent[];
};
