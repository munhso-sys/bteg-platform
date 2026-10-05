"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsAdminRedirect } from "@/components/settings/SettingsAdminRedirect";

type UserRow = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  heltes_name: string | null;
  alba_name: string | null;
  position_name: string | null;
  role_id: string | null;
  status: string;
};

type Role = { id: string; label: string };

const USER_STATUS_OPTIONS: Array<{ value: "active" | "inactive"; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/** DB may still store pending/suspended — UI only offers Active/Inactive. */
function statusSelectValue(status: string): "active" | "inactive" {
  return status === "active" ? "active" : "inactive";
}

export default function UsersRolesPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Ачаалахад алдаа");
        return;
      }
      setUsers(data.users ?? []);
      setRoles(data.roles ?? []);
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

  async function updateUser(
    user_id: string,
    patch: { role_id?: string; status?: "active" | "inactive" },
  ) {
    setBusy(user_id);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.error || "Хадгалахад алдаа";
        setError(msg);
        console.error("[users] update failed:", msg, patch);
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === user_id
            ? {
                ...u,
                ...(patch.role_id ? { role_id: patch.role_id } : null),
                ...(patch.status
                  ? {
                      status:
                        patch.status === "active" ? "active" : "suspended",
                    }
                  : null),
              }
            : u,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Алдаа";
      setError(msg);
      console.error("[users] update error:", msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <SettingsAdminRedirect />
      <PageHeader
        title="Хэрэглэгч / Role"
        description="Role-оор модуль, цэс, дата харах/засах эрхийг тохируулна."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} /> Шинэчлэх
          </button>
        }
      />
      <SettingsNav />

      <div className="mb-4 rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted)]">
        Хэрэглэгчид role онооно. <strong className="text-[var(--fg)]">Inactive</strong>{" "}
        сонговол нэвтрэх эрх түр хаагдана. Role бүрийн нэмэлт эрхийг{" "}
        <a href="/settings/roles" className="font-medium text-[var(--brand-dark)] hover:underline">
          Role эрх
        </a>{" "}
        цэснээс тохируулна.
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

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
                  <th>Нэр</th>
                  <th>Имэйл</th>
                  <th>Алба</th>
                  <th>Албан тушаал</th>
                  <th>Role</th>
                  <th>Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-[var(--muted)]">
                      Хэрэглэгч бүртгэлгүй. Хүсэлт баталснаар энд нэмэгдэнэ.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.user_id}>
                      <td className="font-medium">{u.full_name}</td>
                      <td>
                        <div>{u.email}</div>
                        <div className="text-xs text-[var(--muted)]">{u.phone}</div>
                      </td>
                      <td>
                        <div className="text-xs text-[var(--muted)]">
                          {u.heltes_name}
                        </div>
                        <div>{u.alba_name}</div>
                      </td>
                      <td>{u.position_name}</td>
                      <td>
                        <select
                          className="input py-1 text-sm"
                          disabled={busy === u.user_id}
                          value={u.role_id ?? "employee"}
                          onChange={(e) =>
                            void updateUser(u.user_id, { role_id: e.target.value })
                          }
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="input py-1 text-sm"
                          disabled={busy === u.user_id}
                          value={statusSelectValue(u.status)}
                          onChange={(e) =>
                            void updateUser(u.user_id, {
                              status: e.target.value as "active" | "inactive",
                            })
                          }
                        >
                          {USER_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
