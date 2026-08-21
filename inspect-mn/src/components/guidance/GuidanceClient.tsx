"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Loader2,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Save,
  Search,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { GuidanceNav } from "@/components/guidance/GuidanceNav";
import type {
  GuidancePriority,
  GuidanceRecord,
  GuidanceStatus,
  GuidanceUpdateKind,
} from "@/lib/guidance/types";

const STATUS_LABELS: Record<GuidanceStatus, string> = {
  planned: "Төлөвлөсөн",
  in_progress: "Гүйцэтгэж байгаа",
  blocked: "Саатсан",
  completed: "Дууссан",
};

const PRIORITY_LABELS: Record<GuidancePriority, string> = {
  low: "Бага",
  medium: "Дунд",
  high: "Өндөр",
  critical: "Нэн өндөр",
};

const UPDATE_LABELS: Record<GuidanceUpdateKind, string> = {
  plan: "Төлөвлөгөө",
  execution: "Гүйцэтгэл",
  progress: "Явц",
  result: "Үр дүн",
};

type DetailTab = "plan" | "execution" | "result" | "progress";
type FormState = Omit<GuidanceRecord, "id" | "createdAt" | "createdBy" | "createdByName" | "updatedAt" | "updates">;

const EMPTY_FORM: FormState = {
  referenceNo: "",
  title: "",
  objective: "",
  priority: "medium",
  status: "planned",
  progress: 0,
  directiveDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  ownerName: "",
  unitName: "",
  planDetails: "",
  executionNotes: "",
  resultSummary: "",
  resultMetric: "",
  evidence: "",
};

function formFrom(item: GuidanceRecord): FormState {
  return {
    referenceNo: item.referenceNo,
    title: item.title,
    objective: item.objective,
    priority: item.priority,
    status: item.status,
    progress: item.progress,
    directiveDate: item.directiveDate,
    dueDate: item.dueDate,
    ownerName: item.ownerName,
    unitName: item.unitName,
    planDetails: item.planDetails,
    executionNotes: item.executionNotes,
    resultSummary: item.resultSummary,
    resultMetric: item.resultMetric,
    evidence: item.evidence,
  };
}

async function readApiJson(response: Response) {
  const text = await response.text();
  if (response.redirected && new URL(response.url).pathname === "/login") {
    window.location.assign(response.url);
    throw new Error("Нэвтрэх хугацаа дууссан тул дахин нэвтэрнэ үү.");
  }
  if (!text.trim()) {
    throw new Error(`API хоосон хариу өглөө (HTTP ${response.status}).`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`API хариу JSON форматгүй байна (HTTP ${response.status}).`);
  }
}

function apiMessage(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

export function GuidanceClient() {
  const [items, setItems] = useState<GuidanceRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tab, setTab] = useState<DetailTab>("plan");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | GuidanceStatus>("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updateKind, setUpdateKind] = useState<GuidanceUpdateKind>("progress");
  const [updateNote, setUpdateNote] = useState("");
  const [updateProgress, setUpdateProgress] = useState(0);
  const [listOpen, setListOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/guidance", { cache: "no-store" });
      const data = await readApiJson(res);
      if (!res.ok || !data.ok) throw new Error(apiMessage(data, "Ачаалахад алдаа"));
      const next = (data.items ?? []) as GuidanceRecord[];
      setItems(next);
      setCanEdit(Boolean(data.canEdit));
      setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("mn");
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return !term || [item.title, item.referenceNo, item.ownerName, item.unitName].some((value) => value.toLocaleLowerCase("mn").includes(term));
    });
  }, [items, query, statusFilter]);

  const kpis = useMemo(() => ({
    total: items.length,
    planned: items.filter((item) => item.status === "planned").length,
    active: items.filter((item) => item.status === "in_progress" || item.status === "blocked").length,
    completed: items.filter((item) => item.status === "completed").length,
  }), [items]);

  function beginCreate() {
    setCreating(true);
    setEditing(true);
    setSelectedId("");
    setForm({ ...EMPTY_FORM, directiveDate: new Date().toISOString().slice(0, 10) });
    setTab("plan");
    setMessage("");
  }

  function beginEdit() {
    if (!selected) return;
    setCreating(false);
    setEditing(true);
    setForm(formFrom(selected));
    setMessage("");
  }

  function cancelEdit() {
    setEditing(false);
    setCreating(false);
    if (!selectedId && items[0]) setSelectedId(items[0].id);
  }

  async function save() {
    if (!form.title.trim() || !form.objective.trim()) {
      setError("Гарчиг болон зорилго шаардлагатай.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/guidance", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creating ? form : { id: selected?.id, fields: form }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.ok) throw new Error(apiMessage(data, "Хадгалахад алдаа"));
      const saved = data.item as GuidanceRecord;
      setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedId(saved.id);
      setEditing(false);
      setCreating(false);
      setMessage("Удирдамжийн бүртгэл хадгалагдлаа.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа");
    } finally {
      setSaving(false);
    }
  }

  async function addUpdate() {
    if (!selected || !updateNote.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/guidance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          update: { kind: updateKind, note: updateNote, progress: updateProgress },
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok || !data.ok) throw new Error(apiMessage(data, "Явц хадгалахад алдаа"));
      const saved = data.item as GuidanceRecord;
      setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setUpdateNote("");
      setMessage("Явцын тэмдэглэл нэмэгдлээ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Явц хадгалахад алдаа");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Удирдамж"
        description="Удирдамжаар гүйцэтгэх ажлыг төлөвлөж, хэрэгжилтийн явц, гүйцэтгэл, үр дүн болон нотолгоог нэг бүртгэлээр хянана."
        actions={<div className="flex gap-2"><button type="button" className="btn btn-ghost" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Шинэчлэх</button>{canEdit ? <button type="button" className="btn btn-primary" onClick={beginCreate}><Plus size={15} /> Шинэ удирдамж</button> : null}</div>}
      />
      <GuidanceNav />

      {error ? <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">{error}</div> : null}
      {message ? <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</div> : null}

      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi icon={<ClipboardList size={17} />} label="Нийт удирдамж" value={kpis.total} accent="border-l-amber-500" />
        <Kpi icon={<CalendarDays size={17} />} label="Төлөвлөсөн" value={kpis.planned} accent="border-l-sky-500" />
        <Kpi icon={<CircleDot size={17} />} label="Хэрэгжиж байгаа" value={kpis.active} accent="border-l-violet-500" />
        <Kpi icon={<CheckCircle2 size={17} />} label="Дууссан" value={kpis.completed} accent="border-l-emerald-500" />
      </div>

      <div className="mb-3 flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-2 sm:flex-row">
        <label className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-[var(--muted)]" /><input className="input pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Дугаар, нэр, хариуцагч, нэгжээр хайх" /></label>
        <select className="select sm:w-52" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | GuidanceStatus)}><option value="all">Бүх төлөв</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>

      <div className={`grid min-h-[34rem] gap-4 ${listOpen ? "xl:grid-cols-[22rem_minmax(0,1fr)]" : "xl:grid-cols-[10rem_minmax(0,1fr)]"}`}>
        <section className="panel min-h-0 overflow-hidden">
          <div className={`flex items-center border-b border-[var(--border)] px-3 py-2 text-sm font-semibold ${listOpen ? "justify-between" : "justify-center"}`}><span className={listOpen ? "" : "truncate"}>Удирдамжийн жагсаалт <span className="font-normal text-[var(--muted)]">({filtered.length})</span></span><button type="button" className="ml-2 shrink-0 rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)]" onClick={() => setListOpen((open) => !open)} title={listOpen ? "Жагсаалт хураах" : "Жагсаалт дэлгэх"} aria-expanded={listOpen}>{listOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}</button></div>
          {listOpen ? <div className="soft-scroll max-h-[42rem] p-2">
            {loading ? <div className="flex items-center gap-2 p-3 text-sm text-[var(--muted)]"><Loader2 size={16} className="animate-spin" /> Ачаалж байна…</div> : null}
            {!loading && filtered.length === 0 ? <div className="p-6 text-center text-sm text-[var(--muted)]">Бүртгэл олдсонгүй.</div> : null}
            {filtered.map((item) => <GuidanceListItem key={item.id} item={item} active={item.id === selectedId} onClick={() => { setSelectedId(item.id); setEditing(false); setCreating(false); setUpdateProgress(item.progress); }} />)}
          </div> : null}
        </section>

        <section className="panel min-w-0 overflow-hidden">
          {editing ? <GuidanceForm form={form} setForm={setForm} creating={creating} saving={saving} onSave={() => void save()} onCancel={cancelEdit} /> : selected ? <GuidanceDetail item={selected} tab={tab} setTab={setTab} canEdit={canEdit} onEdit={beginEdit} updateKind={updateKind} setUpdateKind={setUpdateKind} updateNote={updateNote} setUpdateNote={setUpdateNote} updateProgress={updateProgress} setUpdateProgress={setUpdateProgress} saving={saving} onAddUpdate={() => void addUpdate()} /> : <EmptyState canEdit={canEdit} onCreate={beginCreate} />}
        </section>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return <div className={`rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] p-3 ${accent}`}><div className="flex items-center gap-2 text-xs text-[var(--muted)]">{icon}{label}</div><div className="mt-1 text-2xl font-semibold text-[var(--fg)]">{value}</div></div>;
}

function GuidanceListItem({ item, active, onClick }: { item: GuidanceRecord; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`mb-1.5 w-full rounded-md border p-3 text-left transition ${active ? "border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/20" : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--surface-muted)]"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-semibold text-[var(--fg)]">{item.title}</div><div className="mt-0.5 text-xs text-[var(--muted)]">{item.referenceNo || "Дугааргүй"} · {item.ownerName || "Хариуцагчгүй"}</div></div><StatusBadge status={item.status} /></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${item.progress}%` }} /></div><div className="mt-1 flex justify-between text-[11px] text-[var(--muted)]"><span>{item.unitName || "Нэгжгүй"}</span><span>{item.progress}%</span></div></button>;
}

function StatusBadge({ status }: { status: GuidanceStatus }) {
  const style = status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : status === "blocked" ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : status === "in_progress" ? "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" : "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300";
  return <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${style}`}>{STATUS_LABELS[status]}</span>;
}

function GuidanceDetail({ item, tab, setTab, canEdit, onEdit, updateKind, setUpdateKind, updateNote, setUpdateNote, updateProgress, setUpdateProgress, saving, onAddUpdate }: { item: GuidanceRecord; tab: DetailTab; setTab: (tab: DetailTab) => void; canEdit: boolean; onEdit: () => void; updateKind: GuidanceUpdateKind; setUpdateKind: (kind: GuidanceUpdateKind) => void; updateNote: string; setUpdateNote: (value: string) => void; updateProgress: number; setUpdateProgress: (value: number) => void; saving: boolean; onAddUpdate: () => void }) {
  const tabs: Array<[DetailTab, string]> = [["plan", "Төлөвлөгөө"], ["execution", "Гүйцэтгэл"], ["result", "Үр дүн"], ["progress", "Явц"]];
  return <div><div className="border-b border-[var(--border)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={item.status} /><span className="text-xs text-[var(--muted)]">{item.referenceNo || "Дугааргүй"}</span></div><h2 className="mt-2 text-lg font-semibold text-[var(--fg)]">{item.title}</h2><p className="mt-1 text-sm text-[var(--muted)]">{item.objective}</p></div>{canEdit ? <button type="button" className="btn" onClick={onEdit}>Засах</button> : null}</div><div className="mt-4 grid gap-2 text-xs sm:grid-cols-4"><Meta label="Хариуцагч" value={item.ownerName} /><Meta label="Нэгж" value={item.unitName} /><Meta label="Дуусах хугацаа" value={item.dueDate} /><Meta label="Ач холбогдол" value={PRIORITY_LABELS[item.priority]} /></div><div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full bg-[var(--brand)]" style={{ width: `${item.progress}%` }} /></div><span className="text-sm font-semibold">{item.progress}%</span></div></div>
    <div className="flex overflow-x-auto border-b border-[var(--border)] px-2">{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium ${tab === id ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)]"}`}>{label}</button>)}</div>
    <div className="max-h-[31rem] overflow-y-auto p-4">{tab === "plan" ? <Section title="Төлөвлөлт"><Info label="Удирдамж өгсөн огноо" value={item.directiveDate} /><Info label="Зорилго" value={item.objective} /><Info label="Ажлын төлөвлөгөө" value={item.planDetails} /></Section> : null}{tab === "execution" ? <Section title="Гүйцэтгэл"><Info label="Хэрэгжилтийн тэмдэглэл" value={item.executionNotes} /><Info label="Нотолгоо / холбоос" value={item.evidence} /></Section> : null}{tab === "result" ? <Section title="Үр дүн"><Info label="Үр дүнгийн дүгнэлт" value={item.resultSummary} /><Info label="Хэмжигдэхүйц үр дүн / KPI" value={item.resultMetric} /></Section> : null}{tab === "progress" ? <ProgressPanel item={item} canEdit={canEdit} updateKind={updateKind} setUpdateKind={setUpdateKind} updateNote={updateNote} setUpdateNote={setUpdateNote} updateProgress={updateProgress} setUpdateProgress={setUpdateProgress} saving={saving} onAddUpdate={onAddUpdate} /> : null}</div></div>;
}

function GuidanceForm({ form, setForm, creating, saving, onSave, onCancel }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; creating: boolean; saving: boolean; onSave: () => void; onCancel: () => void }) {
  const field = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  return <div><div className="flex items-center justify-between border-b border-[var(--border)] p-4"><div><h2 className="font-semibold">{creating ? "Шинэ удирдамж бүртгэх" : "Удирдамж засах"}</h2><p className="text-xs text-[var(--muted)]">Төлөвлөгөө, гүйцэтгэл, үр дүнг нэг бүртгэлд хадгална.</p></div><div className="flex gap-2"><button type="button" className="btn" onClick={onCancel}>Болих</button><button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Хадгалах</button></div></div><div className="max-h-[40rem] space-y-5 overflow-y-auto p-4"><FormSection title="Үндсэн мэдээлэл"><div className="grid gap-3 sm:grid-cols-2"><Field label="Удирдамжийн дугаар"><input className="input" value={form.referenceNo} onChange={(e) => field("referenceNo", e.target.value)} /></Field><Field label="Удирдамж өгсөн огноо"><input className="input" type="date" value={form.directiveDate} onChange={(e) => field("directiveDate", e.target.value)} /></Field><Field label="Гарчиг *" wide><input className="input" value={form.title} onChange={(e) => field("title", e.target.value)} /></Field><Field label="Зорилго *" wide><textarea className="textarea min-h-20" value={form.objective} onChange={(e) => field("objective", e.target.value)} /></Field><Field label="Хариуцагч"><input className="input" value={form.ownerName} onChange={(e) => field("ownerName", e.target.value)} /></Field><Field label="Алба / хэлтэс"><input className="input" value={form.unitName} onChange={(e) => field("unitName", e.target.value)} /></Field><Field label="Дуусах хугацаа"><input className="input" type="date" value={form.dueDate} onChange={(e) => field("dueDate", e.target.value)} /></Field><Field label="Ач холбогдол"><select className="select" value={form.priority} onChange={(e) => field("priority", e.target.value as GuidancePriority)}>{Object.entries(PRIORITY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="Төлөв"><select className="select" value={form.status} onChange={(e) => field("status", e.target.value as GuidanceStatus)}>{Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label={`Явц · ${form.progress}%`}><input className="w-full accent-amber-600" type="range" min="0" max="100" step="5" value={form.progress} onChange={(e) => field("progress", Number(e.target.value))} /></Field></div></FormSection><FormSection title="Төлөвлөлт"><textarea className="textarea min-h-28" placeholder="Гүйцэтгэх ажил, үе шат, шалгуур, шаардлагатай нөөц…" value={form.planDetails} onChange={(e) => field("planDetails", e.target.value)} /></FormSection><FormSection title="Гүйцэтгэл"><textarea className="textarea min-h-28" placeholder="Хийсэн ажил, шийдвэр, тулгарсан асуудал…" value={form.executionNotes} onChange={(e) => field("executionNotes", e.target.value)} /><textarea className="textarea mt-2 min-h-20" placeholder="Нотлох баримт, файл эсвэл холбоос…" value={form.evidence} onChange={(e) => field("evidence", e.target.value)} /></FormSection><FormSection title="Үр дүн"><textarea className="textarea min-h-24" placeholder="Гарсан үр дүн, нөлөөлөл, цаашдын арга хэмжээ…" value={form.resultSummary} onChange={(e) => field("resultSummary", e.target.value)} /><input className="input mt-2" placeholder="Хэмжигдэхүйц үр дүн / KPI" value={form.resultMetric} onChange={(e) => field("resultMetric", e.target.value)} /></FormSection></div></div>;
}

function ProgressPanel({ item, canEdit, updateKind, setUpdateKind, updateNote, setUpdateNote, updateProgress, setUpdateProgress, saving, onAddUpdate }: { item: GuidanceRecord; canEdit: boolean; updateKind: GuidanceUpdateKind; setUpdateKind: (kind: GuidanceUpdateKind) => void; updateNote: string; setUpdateNote: (value: string) => void; updateProgress: number; setUpdateProgress: (value: number) => void; saving: boolean; onAddUpdate: () => void }) {
  return <div>{canEdit ? <div className="mb-5 rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20"><div className="text-sm font-semibold">Явцын тэмдэглэл нэмэх</div><div className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr]"><select className="select" value={updateKind} onChange={(e) => setUpdateKind(e.target.value as GuidanceUpdateKind)}>{Object.entries(UPDATE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><textarea className="textarea min-h-20" value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} placeholder="Хийсэн ажил, өөрчлөлт, саад, шийдвэр…" /></div><div className="mt-3 flex flex-wrap items-center gap-3"><label className="flex min-w-56 flex-1 items-center gap-3 text-xs"><span>Явц</span><input className="flex-1 accent-amber-600" type="range" min="0" max="100" step="5" value={updateProgress} onChange={(e) => setUpdateProgress(Number(e.target.value))} /><strong>{updateProgress}%</strong></label><button type="button" className="btn btn-primary" onClick={onAddUpdate} disabled={saving || !updateNote.trim()}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Нэмэх</button></div></div> : null}<div className="space-y-3">{item.updates.slice().reverse().map((update) => <div key={update.id} className="relative border-l-2 border-amber-300 pl-4"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-[var(--brand)]">{UPDATE_LABELS[update.kind]}</span><span className="text-xs text-[var(--muted)]">{new Date(update.createdAt).toLocaleString("mn-MN")} · {update.createdByName}</span><span className="ml-auto text-xs font-semibold">{update.progress}%</span></div><p className="mt-1 whitespace-pre-wrap text-sm">{update.note}</p></div>)}</div></div>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div className="rounded bg-[var(--surface-muted)] px-2.5 py-2"><div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div><div className="mt-0.5 truncate font-medium text-[var(--fg)]">{value || "—"}</div></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="border-b border-[var(--border)] py-3 last:border-0"><div className="text-xs font-semibold text-[var(--muted)]">{label}</div><div className="mt-1 whitespace-pre-wrap text-sm text-[var(--fg)]">{value || "—"}</div></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <div><h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Target size={15} className="text-[var(--brand)]" />{title}</h3>{children}</div>; }
function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-2 border-l-2 border-[var(--brand)] pl-2 text-sm font-semibold">{title}</h3>{children}</section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`block text-xs font-medium ${wide ? "sm:col-span-2" : ""}`}>{label}<div className="mt-1">{children}</div></label>; }
function EmptyState({ canEdit, onCreate }: { canEdit: boolean; onCreate: () => void }) { return <div className="flex min-h-[32rem] flex-col items-center justify-center p-8 text-center"><AlertTriangle size={28} className="text-[var(--brand)]" /><div className="mt-3 font-semibold">Удирдамж сонгоно уу</div><p className="mt-1 max-w-sm text-sm text-[var(--muted)]">Жагсаалтаас бүртгэл сонгох эсвэл шинэ удирдамжийн ажлыг төлөвлөж эхэлнэ үү.</p>{canEdit ? <button type="button" className="btn btn-primary mt-4" onClick={onCreate}><Plus size={14} /> Шинэ удирдамж</button> : null}</div>; }
