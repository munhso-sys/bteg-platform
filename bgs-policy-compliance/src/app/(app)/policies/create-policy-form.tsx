"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/ui/date-input";
import {
  COMPANY_ALBA_ID,
  COMPANY_HELTES_ID,
  OTHER_ALBA_ID,
  type OrgAssignTree,
} from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";

export function CreatePolicyForm({
  tree,
  onCreated,
}: {
  tree: OrgAssignTree;
  /** Called after successful create (before navigate). Use to close a dialog. */
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heltesId, setHeltesId] = useState(
    tree.heltes[0]?.id ?? tree.other.id,
  );
  const [albaId, setAlbaId] = useState(
    tree.heltes[0]?.albas[0]?.id ?? OTHER_ALBA_ID,
  );

  const albaOptions = useMemo(() => {
    if (heltesId === tree.other.id) {
      return [{ id: OTHER_ALBA_ID, name: "—" }];
    }
    if (heltesId === COMPANY_HELTES_ID) {
      return [{ id: COMPANY_ALBA_ID, name: "Бүх ажилчид (байгууллага)" }];
    }
    return tree.heltes.find((h) => h.id === heltesId)?.albas ?? [];
  }, [heltesId, tree]);

  function onHeltesChange(next: string) {
    setHeltesId(next);
    if (next === tree.other.id) {
      setAlbaId(OTHER_ALBA_ID);
    } else if (next === COMPANY_HELTES_ID) {
      setAlbaId(COMPANY_ALBA_ID);
    } else {
      const albas = tree.heltes.find((h) => h.id === next)?.albas ?? [];
      setAlbaId(albas[0]?.id ?? "");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!heltesId || !albaId) {
      setError("Хэлтэс, алба сонгоно уу");
      return;
    }
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(withBasePath("/api/policies"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          reference_code: fd.get("reference_code") || null,
          approved_date: fd.get("approved_date") || null,
          status: "draft",
        }),
      });
      if (!res.ok) {
        throw new Error("Журам үүсгэж чадсангүй");
      }
      const data = (await res.json()) as { id: string; name?: string };

      const orgRes = await fetch(withBasePath(`/api/policies/${data.id}/org`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heltes_id: heltesId, alba_id: albaId }),
      });
      if (!orgRes.ok) {
        const orgData = (await orgRes.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          orgData?.error ||
            "Журам үүссэн боловч хэлтэс/алба холбож чадсангүй",
        );
      }

      onCreated?.();
      router.push(`/policies/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Журам үүсгэж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <label className="block">
        <span className="text-xs text-slate-500">Нэр</span>
        <input
          name="name"
          required
          autoFocus
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Лавлах код</span>
        <input
          name="reference_code"
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Хэлтэс / хамрах хүрээ</span>
        <select
          value={heltesId}
          onChange={(e) => onHeltesChange(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
        >
          {tree.heltes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
          <option value={tree.other.id}>{tree.other.name}</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Алба / хамрах хүрээ</span>
        <select
          value={albaId}
          disabled={
            heltesId === tree.other.id || heltesId === COMPANY_HELTES_ID
          }
          onChange={(e) => setAlbaId(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1.5 disabled:bg-slate-50"
        >
          {albaOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      {heltesId === COMPANY_HELTES_ID ? (
        <p className="text-[11px] text-slate-500">
          Бүх хэрэглэгчид журам/хэсэг/зүйл харна
        </p>
      ) : null}
      <label className="block">
        <span className="text-xs text-slate-500">Батлагдсан огноо</span>
        <DateInput name="approved_date" className="mt-0.5" />
      </label>
      <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
        Шинэ журам <span className="font-medium">Ноорог</span> төлөвтэй
        үүснэ. Идэвхжүүлэхийн тулд Ноорог хүснэгтээс төлөв солих icon
        ашиглана.
      </p>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
      >
        {pending ? "Хадгалж байна…" : "Үүсгэх"}
      </button>
    </form>
  );
}
