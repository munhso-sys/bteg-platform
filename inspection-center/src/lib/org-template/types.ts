export type AllocatedTemplateRef = {
  id: string;
  title: string;
  code?: string | null;
};

export type OrgTemplateAllocation = {
  id: string;
  heltesId: string;
  heltesName: string;
  albaId: string;
  albaName: string;
  templateIds: string[];
  templates: AllocatedTemplateRef[];
  updatedAt: string;
  updatedBy?: string | null;
};

export type OrgTemplateAllocationStore = {
  version: 1;
  allocations: OrgTemplateAllocation[];
};

export function emptyAllocationStore(): OrgTemplateAllocationStore {
  return { version: 1, allocations: [] };
}

export function allocationKey(heltesId: string, albaId: string) {
  return `${heltesId}::${albaId}`;
}
