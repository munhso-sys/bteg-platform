/** Shared (client-safe) org assignment types — no Node/fs imports. */

export const DIRECT_ALBA_ID = "_direct";
export const OTHER_HELTES_ID = "other";
export const OTHER_ALBA_ID = "alba:other";

export type OrgAssignTree = {
  heltes: Array<{
    id: string;
    name: string;
    albas: Array<{ id: string; name: string }>;
  }>;
  other: { id: string; name: string };
};

export type PositionListRow = {
  id: string;
  name: string;
  bteg_id: string | null;
  official_code: string | null;
  organization_name: string;
  heltesId: string;
  albaId: string;
  heltes: string;
  alba: string;
  has_job_description: boolean;
  link_count: number;
};

export function orgPath(heltesId: string, albaId?: string, rest?: string) {
  const base = `/org/heltes/${encodeURIComponent(heltesId)}`;
  if (!albaId) return base;
  const alba = `${base}/alba/${encodeURIComponent(albaId)}`;
  return rest ? `${alba}/${rest}` : alba;
}

/** Client-safe tree for /org Collapse·Expand explorer. */
export type OrgExplorerHeltes = {
  heltesId: string;
  heltesName: string;
  albaCount: number;
  positionCount: number;
  policyCount: number;
  avgScore: number | null;
  albas: Array<{
    albaId: string;
    albaName: string;
    positionCount: number;
    policyCount: number;
    avgScore: number | null;
    isDirect: boolean;
  }>;
};
