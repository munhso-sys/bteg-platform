"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, PanelLeftClose, PanelLeftOpen, Plus, RefreshCw, Save, Search, SendToBack } from "lucide-react";
import { GuidanceNav } from "@/components/guidance/GuidanceNav";
import { PageHeader } from "@/components/ui/PageHeader";
import type { OtherWorkCategory, OtherWorkRecord, OtherWorkStatus } from "@/lib/guidance/other-types";

const CATEGORY_LABELS: Record<OtherWorkCategory, string> = {
  daily: "Өдөр тутам",
  per_shift: "Ээлж бүр",
  recurring: "Давтамжтай",
  on_demand: "Шаардлагаар",
  other: "Бусад",
};

const STATUS_LABELS: Record<OtherWorkStatus, string> = {
  planned: "Төлөвлөсөн",
  in_progress: "Гүйцэтгэж байгаа",
  handed_over: "Хүлээлцсэн",
  completed: "Дууссан",
  cancelled: "Цуцалсан",
};

type WorkForm = Omit<OtherWorkRecord, "id" | "createdAt" | "createdBy" | "createdByName" | "updatedAt" | "updates">;

function localDateTime(offsetHours = 0) {
  const date = new Date(Date.now() + offsetHours * 3_600_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

const EMPTY_FORM: WorkForm = {
  workName: "",
  category: "daily",
  frequencyDetail: "",
  startAt: localDateTime(),
  endAt: "",
  status: "planned",
  progress: 0,
  plan: "",
  execution: "",
  result: "",
  responsibleName: "",
  unitName: "",
  approvedByName: "",
  approvedAt: "",
  handoverToName: "",
  handoverAt: "",
  handoverNote: "",
  otherInfo: "",
};

function formFrom(item: OtherWorkRecord): WorkForm {
  return {
    workName: item.workName, category: item.category, frequencyDetail: item.frequencyDetail,
    startAt: item.startAt, endAt: item.endAt, status: item.status, progress: item.progress,
    plan: item.plan, execution: item.execution, result: item.result,
    responsibleName: item.responsibleName, unitName: item.unitName,
    approvedByName: item.approvedByName, approvedAt: item.approvedAt,
    handoverToName: item.handoverToName, handoverAt: item.handoverAt,
    handoverNote: item.handoverNote, otherInfo: item.otherInfo,
  };
}

async function json(response: Response) {
  const text = await response.text();
  if (response.redirected && new URL(response.url).pathname === "/login") {
    window.location.assign(response.url);
    throw new Error("Нэвтрэх хугацаа дууссан байна.");
  }
  if (!text.trim()) throw new Error(`API хоосон хариу өглөө (HTTP ${response.status}).`);
  try { return JSON.parse(text) as Record<string, unknown>; } catch { throw new Error(`API JSON форматгүй байна (HTTP ${response.status}).`); }
}

function errorMessage(data: Record<string, unknown>, fallback: string) {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

export function OtherWorkClient() {
  const [items, setItems] = useState<OtherWorkRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<WorkForm>(EMPTY_FORM);
  const [updateNote, setUpdateNote] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | OtherWorkCategory>("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [listOpen, setListOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/guidance/other", { cache: "no-store" });
      const data = await json(response);
      if (!response.ok || !data.ok) throw new Error(errorMessage(data, "Ачаалахад алдаа"));
      const next = (data.items ?? []) as OtherWorkRecord[];
      setItems(next); setCanEdit(Boolean(data.canEdit));
      setSelectedId((id) => id && next.some((item) => item.id === id) ? id : next[0]?.id ?? "");
    } catch (err) { setError(err instanceof Error ? err.message : "Ачаалахад алдаа"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("mn");
    return items.filter((item) => (category === "all" || item.category === category) && (!term || [item.workName, item.responsibleName, item.handoverToName, item.unitName].some((value) => value.toLocaleLowerCase("mn").includes(term))));
  }, [items, query, category]);
  const kpis = useMemo(() => ({ total: items.length, active: items.filter((item) => item.status === "in_progress").length, handover: items.filter((item) => item.status === "handed_over").length, completed: items.filter((item) => item.status === "completed").length }), [items]);

  function create() {
    setCreating(true); setEditing(true); setSelectedId("");
    setForm({ ...EMPTY_FORM, startAt: localDateTime() }); setUpdateNote(""); setMessage("");
  }

  function edit() {
    if (!selected) return;
    setCreating(false); setEditing(true); setForm(formFrom(selected)); setUpdateNote("");
  }

  async function save() {
    if (!form.workName.trim()) { setError("Ажлын нэр шаардлагатай."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/guidance/other", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creating ? form : { id: selected?.id, fields: form, updateNote }),
      });
      const data = await json(response);
      if (!response.ok || !data.ok) throw new Error(errorMessage(data, "Хадгалахад алдаа"));
      const saved = data.item as OtherWorkRecord;
      setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSelectedId(saved.id); setEditing(false); setCreating(false); setUpdateNote(""); setMessage("Ажлын бүртгэл хадгалагдлаа.");
    } catch (err) { setError(err instanceof Error ? err.message : "Хадгалахад алдаа"); }
    finally { setSaving(false); }
  }

  return <div><PageHeader title="Бусад ажил" description="Өдөр тутмын, ээлж бүрийн, давтамжтай болон шаардлага гарсан үед хийх ажлыг гүйцэтгэл, баталгаажуулалт, ажил хүлээлцсэн мэдээлэлтэй бүртгэнэ." actions={<div className="flex gap-2"><button type="button" className="btn" onClick={() => void load()}><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Шинэчлэх</button>{canEdit ? <button type="button" className="btn btn-primary" onClick={create}><Plus size={14} /> Шинэ ажил</button> : null}</div>} /><GuidanceNav />
    {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p> : null}{message ? <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{message}</p> : null}
    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4"><Kpi icon={<Clock3 size={16} />} label="Нийт ажил" value={kpis.total} color="border-l-amber-500" /><Kpi icon={<RefreshCw size={16} />} label="Гүйцэтгэж байгаа" value={kpis.active} color="border-l-violet-500" /><Kpi icon={<SendToBack size={16} />} label="Хүлээлцсэн" value={kpis.handover} color="border-l-sky-500" /><Kpi icon={<CheckCircle2 size={16} />} label="Дууссан" value={kpis.completed} color="border-l-emerald-500" /></div>
    <div className="mb-3 flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-2 sm:flex-row"><label className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-[var(--muted)]" /><input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ажил, хариуцагч, нэгжээр хайх" /></label><select className="select sm:w-48" value={category} onChange={(e) => setCategory(e.target.value as "all" | OtherWorkCategory)}><option value="all">Бүх төрөл</option>{Object.entries(CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
    <div className={`grid min-h-[36rem] gap-4 ${listOpen ? "xl:grid-cols-[22rem_minmax(0,1fr)]" : "xl:grid-cols-[10rem_minmax(0,1fr)]"}`}><section className="panel overflow-hidden"><div className={`flex items-center border-b border-[var(--border)] px-3 py-2 text-sm font-semibold ${listOpen ? "justify-between" : "justify-center"}`}><span className={listOpen ? "" : "truncate"}>Ажлын жагсаалт ({filtered.length})</span><button type="button" className="ml-2 shrink-0 rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)]" onClick={() => setListOpen((open) => !open)} title={listOpen ? "Жагсаалт хураах" : "Жагсаалт дэлгэх"} aria-expanded={listOpen}>{listOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}</button></div>{listOpen ? <div className="soft-scroll max-h-[43rem] p-2">{loading ? <p className="p-3 text-sm text-[var(--muted)]">Ачаалж байна…</p> : null}{!loading && filtered.length === 0 ? <p className="p-6 text-center text-sm text-[var(--muted)]">Бүртгэл олдсонгүй.</p> : null}{filtered.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setEditing(false); }} className={`mb-1.5 w-full rounded-md border p-3 text-left ${selectedId === item.id ? "border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/20" : "border-[var(--border)] hover:bg-[var(--surface-muted)]"}`}><div className="flex items-start justify-between gap-2"><span className="min-w-0 truncate text-sm font-semibold">{item.workName}</span><span className="shrink-0 rounded bg-[var(--surface-muted)] px-1.5 py-1 text-[10px]">{CATEGORY_LABELS[item.category]}</span></div><div className="mt-1 text-xs text-[var(--muted)]">{item.responsibleName || "Хариуцагчгүй"} · {STATUS_LABELS[item.status]}</div><div className="mt-2 h-1.5 rounded bg-[var(--surface-muted)]"><div className="h-full rounded bg-[var(--brand)]" style={{ width: `${item.progress}%` }} /></div></button>)}</div> : null}</section>
      <section className="panel min-w-0 overflow-hidden">{editing ? <WorkFormPanel form={form} setForm={setForm} updateNote={updateNote} setUpdateNote={setUpdateNote} creating={creating} saving={saving} onCancel={() => { setEditing(false); setCreating(false); if (!selectedId && items[0]) setSelectedId(items[0].id); }} onSave={() => void save()} /> : selected ? <WorkDetail item={selected} canEdit={canEdit} onEdit={edit} /> : <div className="flex min-h-[34rem] flex-col items-center justify-center p-6 text-center"><Clock3 size={26} className="text-[var(--brand)]" /><p className="mt-3 font-semibold">Ажил сонгоно уу</p><p className="mt-1 text-sm text-[var(--muted)]">Жагсаалтаас сонгох эсвэл шинэ ажил бүртгэнэ.</p>{canEdit ? <button className="btn btn-primary mt-4" onClick={create}><Plus size={14} /> Шинэ ажил</button> : null}</div>}</section></div>
  </div>;
}

function WorkFormPanel({ form, setForm, updateNote, setUpdateNote, creating, saving, onCancel, onSave }: { form: WorkForm; setForm: React.Dispatch<React.SetStateAction<WorkForm>>; updateNote: string; setUpdateNote: (value: string) => void; creating: boolean; saving: boolean; onCancel: () => void; onSave: () => void }) {
  const set = <K extends keyof WorkForm>(key: K, value: WorkForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  return <div><div className="flex items-center justify-between border-b border-[var(--border)] p-4"><div><h2 className="font-semibold">{creating ? "Шинэ ажил бүртгэх" : "Ажлын мэдээлэл шинэчлэх"}</h2><p className="text-xs text-[var(--muted)]">Гүйцэтгэл, баталгаажуулалт, хүлээлцсэн мэдээллийг бүрэн оруулна.</p></div><div className="flex gap-2"><button className="btn" onClick={onCancel}>Болих</button><button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Хадгалах</button></div></div><div className="max-h-[43rem] space-y-5 overflow-y-auto p-4"><FormSection title="Үндсэн мэдээлэл"><div className="grid gap-3 sm:grid-cols-2"><Field label="Ажлын нэр *" wide><input className="input" value={form.workName} onChange={(e) => set("workName", e.target.value)} /></Field><Field label="Ажлын төрөл"><select className="select" value={form.category} onChange={(e) => set("category", e.target.value as OtherWorkCategory)}>{Object.entries(CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="Давтамж / нөхцөл"><input className="input" value={form.frequencyDetail} onChange={(e) => set("frequencyDetail", e.target.value)} placeholder="Өдөр бүр 08:00, 7 хоног бүр…" /></Field><Field label="Эхлэх хугацаа"><input className="input" type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} /></Field><Field label="Дуусах хугацаа"><input className="input" type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} /></Field><Field label="Төлөв"><select className="select" value={form.status} onChange={(e) => set("status", e.target.value as OtherWorkStatus)}>{Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label={`Явц · ${form.progress}%`}><input className="w-full accent-amber-600" type="range" min="0" max="100" step="5" value={form.progress} onChange={(e) => set("progress", Number(e.target.value))} /></Field><Field label="Хариуцагч"><input className="input" value={form.responsibleName} onChange={(e) => set("responsibleName", e.target.value)} /></Field><Field label="Алба / хэлтэс"><input className="input" value={form.unitName} onChange={(e) => set("unitName", e.target.value)} /></Field></div></FormSection><FormSection title="Төлөвлөгөө · Гүйцэтгэл · Үр дүн"><textarea className="textarea min-h-20" value={form.plan} onChange={(e) => set("plan", e.target.value)} placeholder="Төлөвлөгөө, шалгуур, дараалал…" /><textarea className="textarea mt-2 min-h-20" value={form.execution} onChange={(e) => set("execution", e.target.value)} placeholder="Гүйцэтгэсэн ажил…" /><textarea className="textarea mt-2 min-h-20" value={form.result} onChange={(e) => set("result", e.target.value)} placeholder="Үр дүн, хэмжигдэхүйц өөрчлөлт…" /></FormSection><FormSection title="Баталгаажуулалт"><div className="grid gap-3 sm:grid-cols-2"><Field label="Баталгаажуулсан хүн"><input className="input" value={form.approvedByName} onChange={(e) => set("approvedByName", e.target.value)} /></Field><Field label="Баталгаажуулсан хугацаа"><input className="input" type="datetime-local" value={form.approvedAt} onChange={(e) => set("approvedAt", e.target.value)} /></Field></div></FormSection><FormSection title="Ажил хүлээлцэх"><div className="grid gap-3 sm:grid-cols-2"><Field label="Хүлээн авч үргэлжлүүлэх хүн"><input className="input" value={form.handoverToName} onChange={(e) => set("handoverToName", e.target.value)} /></Field><Field label="Хүлээлцсэн хугацаа"><input className="input" type="datetime-local" value={form.handoverAt} onChange={(e) => set("handoverAt", e.target.value)} /></Field><Field label="Хүлээлцсэн тэмдэглэл" wide><textarea className="textarea min-h-20" value={form.handoverNote} onChange={(e) => set("handoverNote", e.target.value)} /></Field></div></FormSection><FormSection title="Бусад мэдээлэл"><textarea className="textarea min-h-20" value={form.otherInfo} onChange={(e) => set("otherInfo", e.target.value)} placeholder="Файл, холбоос, эрсдэл, саад, нэмэлт тайлбар…" />{!creating ? <textarea className="textarea mt-2 min-h-16" value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} placeholder="Энэ шинэчлэлтийн товч тэмдэглэл…" /> : null}</FormSection></div></div>;
}

function WorkDetail({ item, canEdit, onEdit }: { item: OtherWorkRecord; canEdit: boolean; onEdit: () => void }) {
  return <div><div className="border-b border-[var(--border)] p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex gap-2 text-xs"><span className="rounded bg-amber-100 px-2 py-1 text-amber-700 dark:bg-amber-950 dark:text-amber-300">{CATEGORY_LABELS[item.category]}</span><span className="rounded bg-[var(--surface-muted)] px-2 py-1">{STATUS_LABELS[item.status]}</span></div><h2 className="mt-2 text-lg font-semibold">{item.workName}</h2><p className="mt-1 text-sm text-[var(--muted)]">{item.frequencyDetail || "Давтамж тодорхойлоогүй"}</p></div>{canEdit ? <button className="btn" onClick={onEdit}>Засах</button> : null}</div><div className="mt-4 h-2 rounded bg-[var(--surface-muted)]"><div className="h-full rounded bg-[var(--brand)]" style={{ width: `${item.progress}%` }} /></div><div className="mt-1 text-right text-xs font-semibold">{item.progress}%</div></div><div className="grid max-h-[40rem] gap-0 overflow-y-auto p-4 md:grid-cols-2 md:gap-x-6"><Info label="Эхлэх хугацаа" value={displayDate(item.startAt)} /><Info label="Дуусах хугацаа" value={displayDate(item.endAt)} /><Info label="Хариуцагч" value={item.responsibleName} /><Info label="Алба / хэлтэс" value={item.unitName} /><Info label="Төлөвлөгөө" value={item.plan} wide /><Info label="Гүйцэтгэл" value={item.execution} wide /><Info label="Үр дүн" value={item.result} wide /><Info label="Баталгаажуулсан хүн" value={item.approvedByName} /><Info label="Баталгаажуулсан хугацаа" value={displayDate(item.approvedAt)} /><Info label="Хүлээн авч үргэлжлүүлэх хүн" value={item.handoverToName} /><Info label="Хүлээлцсэн хугацаа" value={displayDate(item.handoverAt)} /><Info label="Хүлээлцсэн тэмдэглэл" value={item.handoverNote} wide /><Info label="Бусад мэдээлэл" value={item.otherInfo} wide /><div className="md:col-span-2"><h3 className="mt-5 border-l-2 border-[var(--brand)] pl-2 text-sm font-semibold">Өөрчлөлтийн түүх</h3><div className="mt-3 space-y-3">{item.updates.slice().reverse().map((update) => <div key={update.id} className="border-l-2 border-amber-300 pl-3"><div className="text-xs text-[var(--muted)]">{new Date(update.createdAt).toLocaleString("mn-MN")} · {update.createdByName} · {update.progress}%</div><p className="mt-1 text-sm">{update.note}</p></div>)}</div></div></div></div>;
}

function displayDate(value: string) { return value ? new Date(value).toLocaleString("mn-MN") : "—"; }
function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) { return <div className={`rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] p-3 ${color}`}><div className="flex items-center gap-2 text-xs text-[var(--muted)]">{icon}{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>; }
function FormSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-2 border-l-2 border-[var(--brand)] pl-2 text-sm font-semibold">{title}</h3>{children}</section>; }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`text-xs font-medium ${wide ? "sm:col-span-2" : ""}`}>{label}<div className="mt-1">{children}</div></label>; }
function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) { return <div className={`border-b border-[var(--border)] py-3 ${wide ? "md:col-span-2" : ""}`}><div className="text-xs font-semibold text-[var(--muted)]">{label}</div><div className="mt-1 whitespace-pre-wrap text-sm">{value || "—"}</div></div>; }
