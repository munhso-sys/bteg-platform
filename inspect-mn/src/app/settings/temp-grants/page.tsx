"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsAdminRedirect } from "@/components/settings/SettingsAdminRedirect";

type UserOpt = {
  user_id: string;
  full_name: string;
  email: string;
  role_id: string | null;
  alba_name: string | null;
};

type Grant = {
  id: string;
  user_id: string;
  permission_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  revoked_at: string | null;
  heltes_id: string | null;
  alba_id: string | null;
};

const EDIT_PERMS = [
  {
    id: "module.inspection.edit",
    label: "Хяналт шалгалт · засах",
  },
  {
    id: "module.policy.edit",
    label: "Журмын биелэлт · засах",
  },
];

export default function TempGrantsPage() {
  const [nowMs, setNowMs] = useState(0);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState("");
  const [permissionId, setPermissionId] = useState(EDIT_PERMS[0].id);
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/temp-grants", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Ачаалахад алдаа");
        return;
      }
      setGrants(data.grants ?? []);
      setUsers(data.users ?? []);
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

  useEffect(() => {
    const id = window.setTimeout(() => setNowMs(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, [grants]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/temp-grants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          permission_id: permissionId,
          ends_at: new Date(endsAt).toISOString(),
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Үүсгэхэд алдаа");
        return;
      }
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/temp-grants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "revoke" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Цуцлахад алдаа");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const nameById = Object.fromEntries(
    users.map((u) => [u.user_id, `${u.full_name} (${u.email})`]),
  );

  return (
    <div>
      <SettingsAdminRedirect />
      <PageHeader
        title="Хугацаатай засах эрх"
        description="ДХШХ мэргэжилтэн / админ тухайн хэрэглэгчид засах эрхийг хугацаатай олгоно."
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

      <section className="mb-6 rounded-md border border-[var(--border)] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">Шинэ эрх олгох</h2>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium">Хэрэглэгч</span>
            <select
              className="input"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Сонгох…</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name} · {u.alba_name || "—"} · {u.role_id}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Эрх</span>
            <select
              className="input"
              value={permissionId}
              onChange={(e) => setPermissionId(e.target.value)}
            >
              {EDIT_PERMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Дуусах хугацаа</span>
            <input
              className="input"
              type="datetime-local"
              required
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium">Шалтгаан</span>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Жишээ: 2026-Q3 зөрчил засах"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Эрх олгох
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin" /> Ачаалж байна…
        </div>
      ) : (
        <section className="overflow-hidden rounded-md border border-[var(--border)] bg-white">
          <div className="h-scroll soft-scroll overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Хэрэглэгч</th>
                  <th>Эрх</th>
                  <th>Хугацаа</th>
                  <th>Төлөв</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => {
                  const active =
                    !g.revoked_at && new Date(g.ends_at).getTime() > nowMs;
                  return (
                    <tr key={g.id}>
                      <td>{nameById[g.user_id] ?? g.user_id}</td>
                      <td className="font-mono text-xs">{g.permission_id}</td>
                      <td className="text-xs">
                        {new Date(g.starts_at).toLocaleString("mn-MN")} →{" "}
                        {new Date(g.ends_at).toLocaleString("mn-MN")}
                        {g.reason ? (
                          <div className="text-[var(--muted)]">{g.reason}</div>
                        ) : null}
                      </td>
                      <td>{g.revoked_at ? "цуцлагдсан" : active ? "идэвхтэй" : "дууссан"}</td>
                      <td>
                        {active ? (
                          <button
                            type="button"
                            className="btn btn-ghost px-2 py-1 text-xs"
                            disabled={busy}
                            onClick={() => void revoke(g.id)}
                          >
                            Цуцлах
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
