export function storePartitionKey(organizationId?: string | null): string {
  const organization = organizationId?.trim();
  return organization ? `org:${organization}` : "global";
}

export function canReuseStorePartition(
  hydratedStoreKey: string | undefined,
  requiredStoreKey: string,
): boolean {
  return hydratedStoreKey === requiredStoreKey;
}
