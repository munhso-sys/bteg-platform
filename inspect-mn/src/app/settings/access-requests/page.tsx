"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsAdminRedirect } from "@/components/settings/SettingsAdminRedirect";

type RequestRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  heltes_name: string;
  alba_name: string;
  position_name: string;
  status: string;
  created_at: string;
  note: string | null;
};

type Role = { id: string; label: string };

const DEFAULT_ROLES: Role[] = [
  { id: "admin", label: "Admin" },
  { id: "leadership", label: "Удирдлага" },
  { id: "dxsh_head", label: "ДХШХ-ийн дарга" },
  { id: "dxsh_specialist", label: "ДХШХ мэргэжилтэн" },
  { id: "unit_manager", label: "Нэгжийн удирдлага" },
  { id: "senior_specialist", label: "Ахлах мэргэжилтэн" },
  { id: "specialist", label: "Мэргэжилтэн" },
  { id: "junior_specialist", label: "Дэд мэргэжилтэн" },
  { id: "employee", label: "Ажилтан" },
  { id: "assistant", label: "Туслах ажилтан" },
];

export default function AccessRequestsPage() {
  const [items, setItems] = useState<RequestRow[]>([]);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleById, setRoleById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reqRes, usersRes] = await Promise.all([
        fetch("/api/admin/access-requests", { cache: "no-store" }),
        fetch("/api/admin/users", { cache: "no-store" }),
      ]);
      const reqData = await reqRes.json();
      const usersData = await usersRes.json();
      if (!reqRes.ok || !reqData.ok) {
        setError(reqData.error || "Ачаалахад алдаа");
        return;
      }
      setItems(reqData.items ?? []);
      if (usersData.ok && usersData.roles?.length) {
        setRoles(usersData.roles);
      }
      const defaults: Record<string, string> = {};
      for (const r of reqData.items ?? []) {
        defaults[r.id] = "employee";
      }
      setRoleById(defaults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError("");
    setOkMsg("");
    setInviteUrl(null);
    try {
      const res = await fetch("/api/admin/access-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          role_id: roleById[id] || "employee",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Үйлдэл амжилтгүй");
        return;
      }
      if (action === "approve") {
        if (data.email_sent) {
          setOkMsg("Баталлаа. Урилгын имэйл илгээгдлээ.");
        } else if (data.invite_url) {
          setOkMsg(
            data.email_error
              ? `Баталлаа, гэхдээ имэйл илгээгдсэнгүй (${data.email_error}). Доорх холбоосыг хэрэглэгчид гараар илгээнэ үү.`
              : "Баталлаа. Доорх холбоосыг хэрэглэгчид гараар илгээнэ үү.",
          );
          setInviteUrl(String(data.invite_url));
        } else {
          setOkMsg(
            data.email_error
              ? `Баталлаа. Имэйл: ${data.email_error}. Хэрэглэгч «Нууц үг мартсан»-аар орж болно.`
              : "Баталлаа.",
          );
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setBusyId(null);
    }
  }

  async function removeRequest(id: string) {
    if (!window.confirm("Энэ хүсэлтийг устгах уу?")) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/access-requests?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Устгахад алдаа");
        return;
      }
      setOkMsg("Устгалаа");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    }
  }

  const pending = items.filter((i) => i.status === "pending");
  const others = items.filter((i) => i.status !== "pending");

  return (
    <div>
      <SettingsAdminRedirect />
      <PageHeader
        title="Нэвтрэх эрхийн хүсэлт"
        description="Login хуудаснаас ирсэн хүсэлтийг батлах эсвэл татгалзах."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} /> Шинэчлэх
          </button>
        }
      />
      <SettingsNav />

      {error ? (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {okMsg ? (
        <div className="mb-3 space-y-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p>{okMsg}</p>
          {inviteUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input min-w-0 flex-1 text-xs"
                readOnly
                value={inviteUrl}
              />
              <button
                type="button"
                className="btn"
                onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              >
                Хуулах
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin" /> Ачаалж байна…
        </div>
      ) : (
        <>
          <section className="mb-6 overflow-hidden rounded-md border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
              Хүлээгдэж буй ({pending.length})
            </div>
            <div className="h-scroll soft-scroll overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Нэр</th>
                    <th>Имэйл / Утас</th>
                    <th>Алба</th>
                    <th>Албан тушаал</th>
                    <th>Role</th>
                    <th>Үйлдэл</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-[var(--muted)]">
                        Хүлээгдэж буй хүсэлт байхгүй
                      </td>
                    </tr>
                  ) : (
                    pending.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.full_name}</td>
                        <td>
                          <div>{r.email}</div>
                          <div className="text-xs text-[var(--muted)]">{r.phone}</div>
                        </td>
                        <td>
                          <div className="text-xs text-[var(--muted)]">{r.heltes_name}</div>
                          <div>{r.alba_name}</div>
                        </td>
                        <td>{r.position_name}</td>
                        <td>
                          <select
                            className="input py-1 text-sm"
                            value={roleById[r.id] || "employee"}
                            onChange={(e) =>
                              setRoleById((prev) => ({
                                ...prev,
                                [r.id]: e.target.value,
                              }))
                            }
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="btn btn-primary px-2 py-1 text-xs"
                              disabled={busyId === r.id}
                              onClick={() => void act(r.id, "approve")}
                            >
                              Батлах
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost px-2 py-1 text-xs"
                              disabled={busyId === r.id}
                              onClick={() => void act(r.id, "reject")}
                            >
                              Татгалзах
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-md border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
              Түүх
            </div>
            <div className="h-scroll soft-scroll overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Нэр</th>
                    <th>Имэйл</th>
                    <th>Төлөв</th>
                    <th>Огноо</th>
                    <th className="col-narrow">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody>
                  {others.slice(0, 50).map((r) => (
                    <tr key={r.id}>
                      <td>{r.full_name}</td>
                      <td>{r.email}</td>
                      <td>{r.status}</td>
                      <td className="text-xs text-[var(--muted)]">
                        {new Date(r.created_at).toLocaleString("mn-MN")}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                          onClick={() => void removeRequest(r.id)}
                          title="Устгах"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
