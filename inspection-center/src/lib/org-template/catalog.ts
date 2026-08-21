function origin() {
  return (
    process.env.NEXT_PUBLIC_POLICY_URL?.replace(/\/$/, "") ||
    "https://platform-policy-compliance.vercel.app"
  );
}

export type OrgCatalog = {
  heltes: Array<{
    id: string;
    name: string;
    albas: Array<{
      id: string;
      name: string;
      positions?: Array<{ id: string; name: string }>;
    }>;
  }>;
};

export async function fetchOrgCatalog(): Promise<OrgCatalog> {
  const res = await fetch(`${origin()}/api/org/access-options`, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Org catalog HTTP ${res.status}`);
  const json = (await res.json()) as { ok?: boolean; heltes?: OrgCatalog["heltes"] };
  if (!json.ok || !Array.isArray(json.heltes)) {
    throw new Error("Org catalog буруу хариу");
  }
  return { heltes: json.heltes };
}
