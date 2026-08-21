"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  FileSearch,
  Files,
  FolderOpen,
  Loader2,
  MessageSquareText,
  Send,
  Search,
  ShieldCheck,
  X,
  Quote,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import type {
  PolicyReviewResult,
  PolicyReviewChatMessage,
  ReviewFindingType,
  StoredPolicySummary,
} from "@/lib/policy-review/types";
import { cn } from "@/lib/cn";

const TYPE_LABELS: Record<ReviewFindingType, string> = {
  difference: "Ялгаа",
  contradiction: "Зөрчилдөөн",
  conflict: "Зөрчилтэй заалт",
  missing_requirement: "Дутуу шаардлага",
  duplicate: "Давхардал",
};

const TYPE_TONES: Record<ReviewFindingType, string> = {
  difference: "border-sky-200 bg-sky-50 text-sky-800",
  contradiction: "border-rose-200 bg-rose-50 text-rose-800",
  conflict: "border-orange-200 bg-orange-50 text-orange-800",
  missing_requirement: "border-amber-200 bg-amber-50 text-amber-800",
  duplicate: "border-violet-200 bg-violet-50 text-violet-800",
};

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

type OrgHeltes = {
  id: string;
  name: string;
  albas: Array<{ id: string; name: string }>;
};

type PolicyFolder = {
  id: string;
  name: string;
  albas: Array<{
    id: string;
    name: string;
    policies: StoredPolicySummary[];
  }>;
};

export function PolicyReviewClient() {
  const [files, setFiles] = useState<File[]>([]);
  const [policies, setPolicies] = useState<StoredPolicySummary[]>([]);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [scopeNote, setScopeNote] = useState("");
  const [orgHeltes, setOrgHeltes] = useState<OrgHeltes[]>([]);
  const [query, setQuery] = useState("");
  const [heltesId, setHeltesId] = useState("");
  const [albaId, setAlbaId] = useState("");
  const [result, setResult] = useState<PolicyReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState<PolicyReviewChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/org/options", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { ok?: boolean; heltes?: OrgHeltes[] };
        if (active && response.ok && data.ok) setOrgHeltes(data.heltes ?? []);
      })
      .catch(() => undefined);
    fetch("/api/policy-review/sources", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          ok?: boolean;
          policies?: StoredPolicySummary[];
          scopeNote?: string;
          error?: string;
        };
        if (!response.ok || !data.ok) throw new Error(data.error || "Журмын жагсаалт уншигдсангүй.");
        if (active) {
          setPolicies(data.policies ?? []);
          setScopeNote(data.scopeNote ?? "");
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Журмын жагсаалт уншигдсангүй.");
      })
      .finally(() => {
        if (active) setSourceLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const heltesOptions = useMemo(() => {
    return orgHeltes
      .map((heltes) => [heltes.id, heltes.name] as const)
      .sort((a, b) => a[1].localeCompare(b[1], "mn"));
  }, [orgHeltes]);

  const albaOptions = useMemo(() => {
    return orgHeltes
      .filter((heltes) => !heltesId || heltes.id === heltesId)
      .flatMap((heltes) => heltes.albas.map((alba) => [alba.id, alba.name] as const))
      .sort((a, b) => a[1].localeCompare(b[1], "mn"));
  }, [orgHeltes, heltesId]);

  const filteredPolicies = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("mn");
    return policies.filter((policy) => {
      const matchesOrg = policy.organizations.some(
        (org) => (!heltesId || org.heltesId === heltesId) && (!albaId || org.id === albaId),
      );
      if ((heltesId || albaId) && !matchesOrg) return false;
      if (!needle) return true;
      return `${policy.referenceCode ?? ""} ${policy.name}`.toLocaleLowerCase("mn").includes(needle);
    });
  }, [policies, query, heltesId, albaId]);

  const policyFolders = useMemo<PolicyFolder[]>(() => {
    const heltesMap = new Map<
      string,
      { id: string; name: string; albas: Map<string, { id: string; name: string; policies: Map<string, StoredPolicySummary> }> }
    >();
    const add = (
      policy: StoredPolicySummary,
      target: { heltesId: string; heltesName: string; albaId: string; albaName: string },
    ) => {
      let heltes = heltesMap.get(target.heltesId);
      if (!heltes) {
        heltes = { id: target.heltesId, name: target.heltesName, albas: new Map() };
        heltesMap.set(target.heltesId, heltes);
      }
      let alba = heltes.albas.get(target.albaId);
      if (!alba) {
        alba = { id: target.albaId, name: target.albaName, policies: new Map() };
        heltes.albas.set(target.albaId, alba);
      }
      alba.policies.set(policy.id, policy);
    };

    for (const policy of filteredPolicies) {
      const visibleOrganizations = policy.organizations.filter(
        (org) => (!heltesId || org.heltesId === heltesId) && (!albaId || org.id === albaId),
      );
      if (visibleOrganizations.length === 0) {
        add(policy, {
          heltesId: policy.organizationScope === "all" ? "all-units" : "unassigned",
          heltesName: policy.organizationScope === "all" ? "Бүх нэгжийн журам" : "Бусад / Нэгж оноогоогүй",
          albaId: "general",
          albaName: "Ерөнхий журам",
        });
        continue;
      }
      for (const org of visibleOrganizations) {
        const targetHeltesId = org.heltesId ?? org.id;
        const targetHeltesName = org.heltesName ?? org.name;
        add(policy, {
          heltesId: targetHeltesId,
          heltesName: targetHeltesName,
          albaId: org.type === "alba" ? org.id : `${org.id}:common`,
          albaName: org.type === "alba" ? org.name : "Хэлтсийн нийтлэг журам",
        });
      }
    }

    return [...heltesMap.values()]
      .map((heltes) => ({
        id: heltes.id,
        name: heltes.name,
        albas: [...heltes.albas.values()]
          .map((alba) => ({ ...alba, policies: [...alba.policies.values()] }))
          .sort((a, b) => a.name.localeCompare(b.name, "mn")),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "mn"));
  }, [filteredPolicies, heltesId, albaId]);

  const sourceCount = files.length + selectedPolicyIds.length;

  function normalizeFiles(next: File[]) {
    const accepted = next.filter((file) => /\.(pdf|txt|md)$/i.test(file.name));
    setFiles(accepted.slice(0, 4));
    setResult(null);
    setChatMessages([]);
    setChatError("");
    setError(accepted.length !== next.length ? "Зөвхөн PDF, TXT, MD файл дэмжинэ." : "");
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    normalizeFiles(Array.from(event.target.files ?? []));
  }

  function dropFiles(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    normalizeFiles(Array.from(event.dataTransfer.files));
  }

  function togglePolicy(policyId: string) {
    setSelectedPolicyIds((current) =>
      current.includes(policyId)
        ? current.filter((id) => id !== policyId)
        : sourceCount >= 6
          ? current
          : [...current, policyId],
    );
    setResult(null);
    setChatMessages([]);
    setChatError("");
  }

  async function runComparison(focus: string) {
    if (sourceCount < 2 || sourceCount > 6 || loading) {
      throw new Error("AI-д асуухын өмнө 2–6 баримт сонгоно уу.");
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      for (const file of files) body.append("files", file);
      for (const policyId of selectedPolicyIds) body.append("policyIds", policyId);
      body.append("focus", focus);
      const response = await fetch("/api/policy-review/compare", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        ok?: boolean;
        result?: PolicyReviewResult;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error || "Харьцуулалт амжилтгүй.");
      }
      setResult(data.result);
      return data.result;
    } finally {
      setLoading(false);
    }
  }

  async function askAboutReview(event: FormEvent) {
    event.preventDefault();
    const message = chatInput.trim();
    if (message.length < 2 || chatLoading || loading) return;
    const userMessage: PolicyReviewChatMessage = { role: "user", content: message };
    const history = [...chatMessages, userMessage];
    setChatMessages(history);
    setChatInput("");
    setChatError("");
    setChatLoading(true);
    try {
      const activeResult = result ?? (await runComparison(message));
      const response = await fetch("/api/policy-review/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: activeResult.id,
          message,
          history: chatMessages.slice(-6),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        answer?: string;
        citations?: PolicyReviewChatMessage["citations"];
        supported?: boolean;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.answer) {
        throw new Error(data.error || "AI хариулж чадсангүй.");
      }
      setChatMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer!,
          citations: data.citations ?? [],
          supported: data.supported ?? false,
        },
      ]);
    } catch (requestError) {
      setChatError(requestError instanceof Error ? requestError.message : "AI хариулж чадсангүй.");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Журам хяналт · Баримт харьцуулалт"
        description="PDF, TXT, MD баримтыг server-side задлан хэсэгчлэж, ялгаа, зөрчил, дутуу болон давхардсан шаардлагыг эшлэлтэй илрүүлнэ."
        actions={
          <Link href="/ai-assistant" className="btn btn-ghost">
            <Bot size={15} /> AI туслах
          </Link>
        }
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,.85fr)]">
        <section className="flex min-h-[620px] max-h-[760px] flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div className="px-4 pt-4">
              <h2 className="text-sm font-semibold text-[var(--fg)]">1. Харьцуулах эх баримтаа сонгох</h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">Дотоод журам болон өөрийн файлыг хослуулж болно.</p>
            </div>
            {scopeNote ? (
              <span className="mr-4 mt-4 inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-[11px] text-[var(--muted)]">
                <ShieldCheck size={13} className="text-emerald-600" /> {scopeNote}
              </span>
            ) : null}
          </div>

          <div className="grid gap-2 px-4 md:grid-cols-[minmax(180px,1fr)_minmax(150px,.7fr)_minmax(150px,.7fr)]">
            <label className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-[var(--muted)]" />
              <input
                className="input w-full pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Журмын нэр, кодоор хайх"
              />
            </label>
            <select
              className="input w-full"
              value={heltesId}
              onChange={(event) => {
                setHeltesId(event.target.value);
                setAlbaId("");
              }}
            >
              <option value="">Бүх хэлтэс</option>
              {heltesOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <select className="input w-full" value={albaId} onChange={(event) => setAlbaId(event.target.value)}>
              <option value="">Бүх алба</option>
              {albaOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>

          <div className="mx-4 mt-3 min-h-0 flex-1 overflow-y-auto rounded-md border border-[var(--border)]">
            {sourceLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-[var(--muted)]">
                <Loader2 size={16} className="animate-spin" /> Журмын санг уншиж байна…
              </div>
            ) : filteredPolicies.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--muted)]">Тохирох, харах эрхтэй журам олдсонгүй.</div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {policyFolders.map((heltes) => {
                  const policyCount = new Set(heltes.albas.flatMap((alba) => alba.policies.map((policy) => policy.id))).size;
                  return (
                    <details key={heltes.id} open={Boolean(heltesId) || policyFolders.length <= 3}>
                      <summary className="sticky top-0 z-[1] flex cursor-pointer list-none items-center gap-2 bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold">
                        <Building2 size={15} className="shrink-0 text-[var(--brand)]" />
                        <span className="min-w-0 flex-1 truncate">{heltes.name}</span>
                        <span className="rounded bg-[var(--card)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--muted)]">{policyCount} журам</span>
                      </summary>
                      <div className="border-t border-[var(--border)] pl-3">
                        {heltes.albas.map((alba) => (
                          <details key={alba.id} open={Boolean(albaId) || heltes.albas.length === 1} className="border-l border-[var(--border)]">
                            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-muted)]">
                              <FolderOpen size={14} className="shrink-0 text-amber-600" />
                              <span className="min-w-0 flex-1 truncate">{alba.name}</span>
                              <span className="text-[10px] font-normal text-[var(--muted)]">{alba.policies.length}</span>
                            </summary>
                            <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                              {alba.policies.map((policy) => {
                                const selected = selectedPolicyIds.includes(policy.id);
                                return (
                                  <label key={`${alba.id}-${policy.id}`} className={cn("flex cursor-pointer items-start gap-3 px-3 py-2.5 pl-7 transition hover:bg-[var(--surface-muted)]", selected && "bg-orange-50/70")}>
                                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--brand)]" checked={selected} onChange={() => togglePolicy(policy.id)} disabled={!selected && sourceCount >= 6} />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-sm font-medium text-[var(--fg)]">{policy.referenceCode ? `${policy.referenceCode} · ` : ""}{policy.name}</span>
                                      <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{policy.clauseCount == null ? "заалтын тоо ачаалагдаагүй" : `${policy.clauseCount} заалт`}{policy.status ? ` · ${policy.status}` : ""}</span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>

          <details className="mx-4 mt-3 shrink-0 rounded-md border border-[var(--border)]" open={files.length > 0}>
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Компьютероос файл нэмэх ({files.length})</summary>
            <div className="max-h-44 overflow-y-auto border-t border-[var(--border)] p-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 hover:border-[var(--brand)]" onDragOver={(event) => event.preventDefault()} onDrop={dropFiles}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-white"><Upload size={17} /></span>
                <span className="min-w-0 flex-1 text-xs"><strong className="block text-sm">Файл сонгох эсвэл чирж оруулах</strong>PDF, TXT, MD · 8 MB · 4 хүртэл файл</span>
                <input className="sr-only" type="file" multiple accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={chooseFiles} />
              </label>
              {files.length > 0 ? (
                <div className="mt-2 space-y-1.5">
                  {files.map((file) => (
                    <div key={fileKey(file)} className="flex items-center gap-2 rounded border border-[var(--border)] px-2 py-1.5 text-xs">
                      <Files size={13} className="shrink-0 text-[var(--brand)]" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span>{(file.size / 1024).toFixed(0)} KB</span>
                      <button type="button" aria-label={`${file.name} хасах`} onClick={() => { setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file))); setResult(null); setChatMessages([]); }}><X size={13} /></button>
                    </div>
                  ))}
                  <div className="text-right text-[11px] text-[var(--muted)]">Нийт {(totalBytes / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              ) : null}
            </div>
          </details>

          <div className="mt-3 shrink-0 border-t border-[var(--border)] px-4 py-3">
            <div className="text-sm font-semibold">{sourceCount} баримт сонгосон</div>
            <div className="text-xs text-[var(--muted)]">2–6 баримт сонгоод хажуугийн чатанд юу хайхаа бичнэ үү.</div>
          </div>
        </section>

        <section className="flex min-h-[620px] max-h-[760px] flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold"><MessageSquareText size={17} className="text-[var(--brand)]" />AI баримт шинжээч</h2>
              <span className="rounded bg-[var(--surface-muted)] px-2 py-1 text-[10px] text-[var(--muted)]">Эшлэл баталгаажуулна</span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">Сонгосон баримтаас юу хайх, юуг харьцуулахыг шууд асууна уу.</p>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--surface-muted)]/40 p-4">
            {chatMessages.length === 0 ? (
              <div className="py-6 text-center">
                <Bot size={28} className="mx-auto text-[var(--brand)]" />
                <h3 className="mt-2 text-sm font-semibold">Харьцуулах чиглэлээ бичнэ үү</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--muted)]">Эхний асуултаар баримтуудыг автоматаар задлан, query-д чиглэсэн харьцуулалт хийнэ.</p>
                <div className="mt-4 grid gap-2 text-left">
                  {["Хугацаа болон зөвшөөрлийн шаардлагын зөрчлийг ол.", "Давхардсан болон дутуу үүргүүдийг KPI-тай нэгтгэ.", "ХАБЭА-тай холбоотой заалтуудыг харьцуул."].map((prompt) => (
                    <button key={prompt} type="button" className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs hover:border-[var(--brand)]" onClick={() => setChatInput(prompt)}>{prompt}</button>
                  ))}
                </div>
              </div>
            ) : chatMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[94%] rounded-lg px-3 py-2 text-sm", message.role === "user" ? "bg-[var(--brand)] text-white" : "border border-[var(--border)] bg-[var(--card)]")}>
                  <p className="whitespace-pre-wrap leading-5">{message.content}</p>
                  {message.role === "assistant" ? <ChatCitations message={message} /> : null}
                </div>
              </div>
            ))}
            {loading || chatLoading ? <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><Loader2 size={14} className="animate-spin" />{loading ? "Асуултад чиглүүлэн баримтуудыг харьцуулж байна…" : "Эх заалтуудыг шалгаж байна…"}</div> : null}
          </div>
          {chatError ? <div className="shrink-0 border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{chatError}</div> : null}
          <form onSubmit={askAboutReview} className="flex shrink-0 items-end gap-2 border-t border-[var(--border)] p-3">
            <textarea className="input min-h-14 flex-1 resize-y" rows={3} value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={sourceCount < 2 ? "Эхлээд 2–6 баримт сонгоно уу…" : "Юу хайж, юуг харьцуулах вэ?"} />
            <button type="submit" className="btn btn-primary h-12" disabled={sourceCount < 2 || chatInput.trim().length < 2 || chatLoading || loading}>{chatLoading || loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}<span className="hidden sm:inline">Асуух</span></button>
          </form>
        </section>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <section className="grid max-h-64 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
            <SummaryCard label="Баримт" value={String(result.documents.length)} description="Сонгож харьцуулсан эх баримт" />
            <SummaryCard label="Задалсан хэсэг" value={String(result.stats.totalChunks)} description="AI шинжилсэн текстийн chunk" />
            <SummaryCard label="Нийт олдвор" value={String(result.findings.length)} description="Илэрсэн бүх ялгаа ба дохио" />
            <SummaryCard label="Өндөр эрсдэл" value={String(result.stats.highRiskFindings)} description="Шуурхай нягтлах high олдвор" tone="warn" />
            <SummaryCard label="Зөрчилдөөн" value={String(result.stats.contradictions + result.stats.conflicts)} description="Эсрэг эсвэл зөрүүтэй заалт" tone="warn" />
            <SummaryCard label="Дутуу шаардлага" value={String(result.stats.missingRequirements)} description="Бусад баримтад дүйцээгүй үүрэг" />
            <SummaryCard label="Давхардал" value={String(result.stats.duplicates)} description="Ижил утгатай давхар зохицуулалт" />
            <SummaryCard label="Эшлэлийн баталгаа" value={`${result.stats.citationCoveragePct}%`} description="Эх текстээр нотлогдсон хувь" tone="good" />
          </section>

          {result.warnings.length > 0 ? (
            <section className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="mb-1 font-semibold">Анхааруулга</div>
              {result.warnings.map((warning) => (
                <div key={warning}>• {warning}</div>
              ))}
            </section>
          ) : null}

          <details className="rounded-md border border-[var(--border)] bg-[var(--card)]" open>
            <summary className="cursor-pointer list-none border-b border-[var(--border)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Дэлгэрэнгүй харьцуулалтын олдвор ({result.findings.length})</h2>
                <p className="text-xs text-[var(--muted)]">
                  {result.mode === "openai" ? "OpenAI structured review + citation validation" : "Deterministic local review"}
                </p>
              </div>
              <span className="text-xs text-[var(--muted)]">
                {new Date(result.generatedAt).toLocaleString("mn-MN")}
              </span>
              </div>
            </summary>

            {result.findings.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--muted)]">
                Нотлох эшлэлтэй ялгаа эсвэл зөрчил илэрсэнгүй.
              </div>
            ) : (
              <div className="max-h-[680px] divide-y divide-[var(--border)] overflow-y-auto">
                {result.findings.map((finding) => (
                  <article key={finding.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className={cn("rounded border px-2 py-0.5 text-[11px] font-semibold", TYPE_TONES[finding.type])}>
                            {TYPE_LABELS[finding.type]}
                          </span>
                          <span className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                            {finding.severity}
                          </span>
                        </div>
                        <h3 className="font-semibold text-[var(--fg)]">{finding.title}</h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">{finding.summary}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{finding.rationale}</p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs font-medium",
                          finding.supported
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700",
                        )}
                      >
                        {finding.supported ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        {finding.supported ? "Эшлэл баталгаатай" : "Дэмжигдээгүй"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 lg:grid-cols-2">
                      {finding.citations.map((source, index) => (
                        <blockquote
                          key={`${source.chunkId}-${index}`}
                          className={cn(
                            "rounded-md border bg-[var(--surface-muted)] p-3 text-sm",
                            source.supported ? "border-[var(--border)]" : "border-rose-200",
                          )}
                        >
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--fg)]">
                            <Quote size={13} className="text-[var(--brand)]" />
                            <span className="truncate">{source.documentName}</span>
                          </div>
                          <p className="leading-5 text-[var(--fg)]">“{source.quote || "Эшлэл ирээгүй"}”</p>
                          <footer className="mt-2 text-[11px] text-[var(--muted)]">
                            {source.page ? `Хуудас ${source.page}` : "Хуудас тодорхойгүй"}
                            {source.section ? ` · ${source.section}` : ""}
                            {!source.supported ? " · эх текстээс баталгаажаагүй" : ""}
                          </footer>
                        </blockquote>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </details>

        </div>
      ) : (
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center">
          <FileSearch size={28} className="mx-auto text-[var(--brand)]" />
          <h2 className="mt-2 font-semibold">Баримтаа сонгоод AI чатанд асуугаарай</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-[var(--muted)]">
            Чатын ой санамжид найдахгүй. Файл бүрийг request дотор шинээр задлан, chunk бүрийн эх байрлалаар citation шалгана.
          </p>
        </section>
      )}
    </div>
  );
}

function ChatCitations({ message }: { message: PolicyReviewChatMessage }) {
  return (
    <div className="mt-2 border-t border-[var(--border)] pt-2">
      <div className={cn("mb-1 text-[11px] font-medium", message.supported ? "text-emerald-600" : "text-amber-600")}>
        {message.supported ? "Эх баримтаар дэмжигдсэн" : "Нотолгоо хангалтгүй эсвэл эшлэлгүй"}
      </div>
      <div className="max-h-64 overflow-y-auto">
        {message.citations?.map((citation, index) => (
          <blockquote key={`${citation.documentName}-${index}`} className="mt-1.5 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-2 text-xs">
            <div className="truncate font-semibold">{citation.documentName}</div>
            <div className="mt-1 leading-4">“{citation.quote}”</div>
            <footer className="mt-1 text-[11px] text-[var(--muted)]">
              {citation.page ? `Хуудас ${citation.page}` : "Хуудас тодорхойгүй"}
              {citation.section ? ` · Заалт ${citation.section}` : ""}
              {!citation.supported ? " · баталгаажаагүй" : ""}
            </footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-600",
          tone === "warn" && "text-rose-600",
        )}
      >
        {value}
      </div>
      <div className="mt-1 min-h-8 text-[10px] leading-4 text-[var(--muted)]">{description}</div>
    </div>
  );
}
