"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Folder,
  FolderOpen,
  X,
} from "lucide-react";
import { Badge, ScoreChip } from "@/components/ui/primitives";
import { useCanAccessPolicyPath } from "@/lib/access/PolicyNavContext";
import { orgPath, type OrgExplorerHeltes } from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";
import { cn, formatDate, truncate } from "@/lib/utils";

export type OrgDrawerOpen = {
  heltesId: string;
  albaId: string;
  tab?: "policies" | "positions";
};

type DrawerState = {
  heltesId: string;
  heltesName: string;
  albaId: string;
  albaName: string;
  tab: "policies" | "positions";
} | null;

type PolicyRow = {
  id: string;
  name: string;
  reference_code: string | null;
  approved_date: string | null;
  clause_count: number;
  linked_position_count: number;
  evaluation_count: number;
  avg_score: number | null;
  scope_label: string;
};

type PositionRow = {
  id: string;
  name: string;
  bteg_id: string | null;
  has_job_description: boolean;
  obligation_count: number;
  avg_score: number | null;
};

type PolicyDetail = {
  policy: {
    id: string;
    name: string;
    reference_code: string | null;
    approved_date: string | null;
    status: string;
  };
  avgScore: number | null;
  scope: Array<{
    id: string;
    target_type: string;
    target_name: string | null;
    target_bteg_id: string | null;
  }>;
  sections: Array<{
    id: string;
    title: string;
    clauses: Array<{
      id: string;
      reference_number: string | null;
      text: string;
      depth: number;
      link_count: number;
    }>;
  }>;
  positionCount: number;
  responsibilityCount: number;
};

function FolderHeader({
  open,
  onToggle,
  label,
  meta,
  depth,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  meta: string;
  depth: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-slate-100",
        depth === 0 && "bg-slate-100 font-semibold",
        depth === 1 && "text-slate-800",
      )}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      {open ? (
        <FolderOpen size={16} className="shrink-0 text-orange-500" />
      ) : (
        <Folder size={16} className="shrink-0 text-slate-400" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-xs text-slate-500">{meta}</span>
    </button>
  );
}

function ContentDrawer({
  state,
  onClose,
  onTab,
}: {
  state: NonNullable<DrawerState>;
  onClose: () => void;
  onTab: (tab: "policies" | "positions") => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [policyDetail, setPolicyDetail] = useState<PolicyDetail | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const scopeKey = `${state.heltesId}|${state.albaId}|${state.tab}`;

  useEffect(() => {
    setSelectedPolicyId(null);
    setPolicyDetail(null);
    setPolicyError(null);
  }, [scopeKey]);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      heltesId: state.heltesId,
      albaId: state.albaId,
      tab: state.tab,
    });
    fetch(withBasePath(`/api/org/alba-content?${qs}`), { signal: ac.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Алдаа (${res.status})`);
        if (state.tab === "policies") setPolicies(data.policies ?? []);
        else setPositions(data.positions ?? []);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Ачаалж чадсангүй");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [state.heltesId, state.albaId, state.tab]);

  useEffect(() => {
    if (!selectedPolicyId) {
      setPolicyDetail(null);
      setPolicyLoading(false);
      setPolicyError(null);
      return;
    }
    const ac = new AbortController();
    setPolicyLoading(true);
    setPolicyError(null);
    fetch(withBasePath(`/api/policies/${selectedPolicyId}`), { signal: ac.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `Алдаа (${res.status})`);
        setPolicyDetail(data as PolicyDetail);
      })
      .catch((err) => {
        if (ac.signal.aborted) return;
        setPolicyError(err instanceof Error ? err.message : "Ачаалж чадсангүй");
      })
      .finally(() => {
        if (!ac.signal.aborted) setPolicyLoading(false);
      });
    return () => ac.abort();
  }, [selectedPolicyId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (selectedPolicyId) setSelectedPolicyId(null);
      else onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, selectedPolicyId]);

  function handleTab(tab: "policies" | "positions") {
    setSelectedPolicyId(null);
    onTab(tab);
  }

  const showingPolicy = Boolean(selectedPolicyId);
  const canOpenPolicyManage = useCanAccessPolicyPath("/policies");
  const canOpenPositionManage = useCanAccessPolicyPath("/positions");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Хаах"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            {showingPolicy ? (
              <button
                type="button"
                onClick={() => setSelectedPolicyId(null)}
                className="mt-0.5 rounded border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
                title="Журмын жагсаалт руу буцах"
                aria-label="Буцах"
              >
                <ArrowLeft size={16} />
              </button>
            ) : null}
            <div className="min-w-0">
              <div className="text-xs text-slate-500">
                {showingPolicy
                  ? `${state.heltesName} · ${state.albaName}`
                  : state.heltesName}
              </div>
              <h2 className="truncate text-lg font-semibold">
                {showingPolicy
                  ? policyDetail?.policy.name || "Журам"
                  : state.albaName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 hover:bg-slate-100"
            aria-label="Хаах"
          >
            <X size={18} />
          </button>
        </div>

        {!showingPolicy ? (
          <div className="flex gap-1 border-b border-slate-200 px-4 py-2">
            <button
              type="button"
              onClick={() => handleTab("policies")}
              className={cn(
                "rounded px-3 py-1.5 text-sm",
                state.tab === "policies"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100",
              )}
            >
              Журам
            </button>
            <button
              type="button"
              onClick={() => handleTab("positions")}
              className={cn(
                "rounded px-3 py-1.5 text-sm",
                state.tab === "positions"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100",
              )}
            >
              Ажлын байр
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2">
            <button
              type="button"
              onClick={() => setSelectedPolicyId(null)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-2.5 py-1.5 text-sm hover:bg-slate-50"
              title="Журмын жагсаалт руу буцах"
              aria-label="Буцах"
            >
              <ArrowLeft size={14} />
              Буцах
            </button>
            {policyDetail ? <ScoreChip score={policyDetail.avgScore} /> : null}
            {selectedPolicyId && canOpenPolicyManage ? (
              <Link
                href={`/policies/${selectedPolicyId}?from=org&heltesId=${encodeURIComponent(state.heltesId)}&albaId=${encodeURIComponent(state.albaId)}&tab=policies`}
                className="ml-auto inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50"
              >
                Бүтэн хуудас <ExternalLink size={12} />
              </Link>
            ) : null}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {showingPolicy ? (
            policyLoading ? (
              <p className="text-sm text-slate-500">Ачаалж байна…</p>
            ) : policyError ? (
              <p className="text-sm text-rose-600">{policyError}</p>
            ) : policyDetail ? (
              <div className="space-y-4">
                <div className="text-sm text-slate-600">
                  <div className="font-mono text-xs">
                    {policyDetail.policy.reference_code || "Кодгүй"}
                  </div>
                  <div>
                    Батлагдсан: {formatDate(policyDetail.policy.approved_date)} ·{" "}
                    {policyDetail.responsibilityCount} холбоос ·{" "}
                    {policyDetail.positionCount} ажлын байр
                  </div>
                </div>
                {policyDetail.scope.length ? (
                  <div className="flex flex-wrap gap-1">
                    {policyDetail.scope.map((s) => (
                      <Badge key={s.id} className="bg-slate-100 text-slate-700">
                        {s.target_name || s.target_bteg_id || s.target_type}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {policyDetail.sections.map((sec) => (
                  <section key={sec.id} className="rounded border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">
                      {sec.title || "Хэсэг"}
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {sec.clauses.map((c) => (
                        <li
                          key={c.id}
                          className="px-3 py-2 text-sm"
                          style={{ paddingLeft: 12 + c.depth * 14 }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="font-mono text-xs text-slate-500">
                                {c.reference_number || "—"}
                              </span>{" "}
                              <span>{c.text}</span>
                            </div>
                            {c.link_count ? (
                              <span className="shrink-0 text-xs text-slate-500">
                                {c.link_count} холбоос
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                      {!sec.clauses.length ? (
                        <li className="px-3 py-2 text-sm text-slate-500">Зүйл байхгүй.</li>
                      ) : null}
                    </ul>
                  </section>
                ))}
              </div>
            ) : null
          ) : loading ? (
            <p className="text-sm text-slate-500">Ачаалж байна…</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : state.tab === "policies" ? (
            <>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-2">Журам</th>
                    <th className="py-1.5 pr-2">Код</th>
                    <th className="py-1.5 pr-2">Зүйл</th>
                    <th className="py-1.5 pr-2">Ажлын байр</th>
                    <th className="py-1.5">Үнэлгээ</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2 pr-2">
                        {canOpenPolicyManage ? (
                          <Link
                            href={`/policies/${p.id}?from=org&heltesId=${encodeURIComponent(state.heltesId)}&albaId=${encodeURIComponent(state.albaId)}&tab=policies`}
                            className="font-medium hover:underline"
                          >
                            {truncate(p.name, 60)}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPolicyId(p.id)}
                            className="text-left font-medium hover:underline"
                          >
                            {truncate(p.name, 60)}
                          </button>
                        )}
                        <div className="text-xs text-slate-500">
                          {formatDate(p.approved_date)} · {p.scope_label}
                        </div>
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {p.reference_code || "—"}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{p.clause_count}</td>
                      <td className="py-2 pr-2 tabular-nums">
                        {p.linked_position_count}
                      </td>
                      <td className="py-2">
                        <ScoreChip score={p.avg_score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!policies.length ? (
                <p className="mt-2 text-sm text-slate-500">Журам олдсонгүй.</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">{policies.length} журам</p>
              )}
            </>
          ) : (
            <>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-2">Ажлын байр</th>
                    <th className="py-1.5 pr-2">BTEG</th>
                    <th className="py-1.5 pr-2">Тодорхойлолт</th>
                    <th className="py-1.5 pr-2">Үүрэг</th>
                    <th className="py-1.5">Үнэлгээ</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2">
                        {canOpenPositionManage ? (
                          <Link
                            href={`${orgPath(
                              state.heltesId,
                              state.albaId,
                              `positions/${p.id}`,
                            )}?from=org`}
                            className="font-medium hover:underline"
                          >
                            {p.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{p.name}</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {p.bteg_id || "—"}
                      </td>
                      <td className="py-2 pr-2">
                        {p.has_job_description ? (
                          <Badge className="bg-emerald-100 text-emerald-800">Тийм</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-900">Үгүй</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{p.obligation_count}</td>
                      <td className="py-2">
                        <ScoreChip score={p.avg_score} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!positions.length ? (
                <p className="mt-2 text-sm text-slate-500">Ажлын байр олдсонгүй.</p>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  {positions.length} ажлын байр
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function syncOrgUrl(
  router: ReturnType<typeof useRouter>,
  drawer: NonNullable<DrawerState> | null,
) {
  if (!drawer) {
    router.replace("/org", { scroll: false });
    return;
  }
  const qs = new URLSearchParams({
    heltesId: drawer.heltesId,
    albaId: drawer.albaId,
    tab: drawer.tab,
  });
  router.replace(`/org?${qs.toString()}`, { scroll: false });
}

export function OrgExplorer({
  tree,
  initialOpen,
}: {
  tree: OrgExplorerHeltes[];
  initialOpen?: OrgDrawerOpen | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(() =>
    initialOpen?.heltesId ? new Set([initialOpen.heltesId]) : new Set(),
  );
  const [drawer, setDrawer] = useState<DrawerState>(() => {
    if (!initialOpen) return null;
    const heltes = tree.find((h) => h.heltesId === initialOpen.heltesId);
    const alba = heltes?.albas.find((a) => a.albaId === initialOpen.albaId);
    if (!heltes || !alba) return null;
    return {
      heltesId: heltes.heltesId,
      heltesName: heltes.heltesName,
      albaId: alba.albaId,
      albaName: alba.albaName,
      tab: initialOpen.tab === "positions" ? "positions" : "policies",
    };
  });

  const allKeys = tree.map((h) => h.heltesId);

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    syncOrgUrl(router, drawer);
  }, [drawer, router]);

  const openDrawer = useCallback(
    (
      heltes: OrgExplorerHeltes,
      alba: OrgExplorerHeltes["albas"][number],
      tab: "policies" | "positions",
    ) => {
      setOpen((prev) => new Set(prev).add(heltes.heltesId));
      setDrawer({
        heltesId: heltes.heltesId,
        heltesName: heltes.heltesName,
        albaId: alba.albaId,
        albaName: alba.albaName,
        tab,
      });
    },
    [],
  );

  function closeDrawer() {
    setDrawer(null);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
          onClick={() => setOpen(new Set(allKeys))}
        >
          Бүгдийг нээх
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
          onClick={() => setOpen(new Set())}
        >
          Бүгдийг хураах
        </button>
        <span className="self-center text-slate-500">{tree.length} хэлтэс</span>
      </div>

      <div className="overflow-hidden rounded border border-slate-200">
        {tree.map((heltes) => {
          const isOpen = open.has(heltes.heltesId);
          return (
            <div key={heltes.heltesId} className="border-b border-slate-100 last:border-b-0">
              <FolderHeader
                open={isOpen}
                onToggle={() => toggle(heltes.heltesId)}
                label={heltes.heltesName}
                meta={`${heltes.albaCount} алба · ${heltes.positionCount} ажлын байр · ${heltes.policyCount} журам`}
                depth={0}
              />
              {isOpen ? (
                <div className="pb-1">
                  {heltes.albas.map((alba) => (
                    <div
                      key={alba.albaId}
                      className="flex flex-wrap items-center gap-2 border-t border-slate-50 px-2 py-1.5"
                      style={{ paddingLeft: 28 }}
                    >
                      <Folder size={14} className="shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{alba.albaName}</div>
                        <div className="text-xs text-slate-500">
                          {alba.positionCount} ажлын байр · {alba.policyCount} журам
                          {alba.isDirect ? " · хэлтэсийн түвшин" : ""}
                        </div>
                      </div>
                      <ScoreChip score={alba.avgScore} />
                      <button
                        type="button"
                        onClick={() => openDrawer(heltes, alba, "policies")}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-orange-50 hover:border-orange-300"
                      >
                        Журам
                      </button>
                      <button
                        type="button"
                        onClick={() => openDrawer(heltes, alba, "positions")}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-orange-50 hover:border-orange-300"
                      >
                        Ажлын байр
                      </button>
                    </div>
                  ))}
                  {!heltes.albas.length ? (
                    <p className="px-4 py-2 text-sm text-slate-500">Алба байхгүй.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {drawer ? (
        <ContentDrawer
          state={drawer}
          onClose={closeDrawer}
          onTab={(tab) => {
            setDrawer((d) => (d ? { ...d, tab } : d));
          }}
        />
      ) : null}
    </div>
  );
}
