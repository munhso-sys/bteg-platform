"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OTHER_ALBA_ID, OTHER_HELTES_ID, type OrgAssignTree } from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";

export function CreatePositionForm({ tree }: { tree: OrgAssignTree }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heltesId, setHeltesId] = useState(tree.heltes[0]?.id ?? OTHER_HELTES_ID);
  const [albaId, setAlbaId] = useState(tree.heltes[0]?.albas[0]?.id ?? OTHER_ALBA_ID);

  const albaOptions = useMemo(() => {
    if (heltesId === tree.other.id || heltesId === OTHER_HELTES_ID) {
      return [{ id: OTHER_ALBA_ID, name: "—" }];
    }
    return tree.heltes.find((h) => h.id === heltesId)?.albas ?? [];
  }, [heltesId, tree]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(withBasePath("/api/positions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          bteg_id: fd.get("bteg_id") || null,
          official_code: fd.get("official_code") || null,
          organization_name: fd.get("organization_name") || null,
          heltes_id: heltesId,
          alba_id: albaId,
          description: fd.get("description") || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      const data = (await res.json()) as { id: string };
      router.push(`/positions/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Үүсгэж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <input
        name="name"
        required
        placeholder="Ажлын байрны нэр"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <input
        name="organization_name"
        placeholder="Байгууллагын нэр"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <select
        value={heltesId}
        onChange={(e) => {
          const next = e.target.value;
          setHeltesId(next);
          if (next === tree.other.id) {
            setAlbaId(OTHER_ALBA_ID);
          } else {
            const albas = tree.heltes.find((h) => h.id === next)?.albas ?? [];
            setAlbaId(albas[0]?.id ?? OTHER_ALBA_ID);
          }
        }}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5"
      >
        {tree.heltes.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
        <option value={tree.other.id}>{tree.other.name}</option>
      </select>
      <select
        value={albaId}
        disabled={heltesId === tree.other.id}
        onChange={(e) => setAlbaId(e.target.value)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 disabled:bg-slate-50"
      >
        {albaOptions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <input
        name="bteg_id"
        placeholder="BTEG id (заавал биш)"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <input
        name="official_code"
        placeholder="Албан тушаалын код"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <textarea
        name="description"
        rows={2}
        placeholder="Тайлбар"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <button
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
      >
        Үүсгэх
      </button>
    </form>
  );
}
