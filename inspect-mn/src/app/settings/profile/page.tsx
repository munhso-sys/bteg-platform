"use client";

import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { PageHeader } from "@/components/ui/PageHeader";

type Profile = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  position_name?: string | null;
  heltes_name?: string | null;
  alba_name?: string | null;
  telegram_id?: string | null;
  role_label?: string | null;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-[var(--fg)] break-words">
        {value || "—"}
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [canManageSettings, setCanManageSettings] = useState(false);
  const [telegramId, setTelegramId] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, accessRes] = await Promise.all([
          fetch("/api/me/profile", { cache: "no-store" }),
          fetch("/api/me/access", { cache: "no-store" }),
        ]);
        const profileData = await profileRes.json();
        const accessData = await accessRes.json();
        if (cancelled) return;
        if (profileData.ok && profileData.profile) {
          setProfile(profileData.profile);
          setTelegramId(profileData.profile.telegram_id ?? "");
          setPhone(profileData.profile.phone ?? "");
        }
        const perms: string[] = accessData.permissions ?? [];
        setCanManageSettings(
          Boolean(
            accessData.isAdmin ||
              perms.includes("portal.settings") ||
              perms.includes("portal.admin"),
          ),
        );
      } catch {
        if (!cancelled) setError("Профайл уншиж чадсангүй");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveEditable() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: telegramId.trim() || null,
          phone: phone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Хадгалж чадсангүй");
      }
      setProfile((prev) => ({ ...prev, ...data.profile }));
      setMessage("Хадгаллаа.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setSaving(false);
    }
  }

  const org =
    [profile?.heltes_name, profile?.alba_name].filter(Boolean).join(" · ") ||
    "—";

  return (
    <div>
      <PageHeader
        title="Миний профайл"
        description="Таны овог нэр, ажлын байр, холбоо барих мэдээлэл."
        actions={<LogoutButton />}
      />

      {canManageSettings ? <SettingsNav /> : null}

      {loading ? (
        <div className="h-40 animate-pulse rounded-md border border-[var(--border)] bg-[var(--surface-muted)]" />
      ) : (
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Овог нэр" value={profile?.full_name?.trim() || "—"} />
            <Field
              label="Ажлын байр (Албан тушаал)"
              value={profile?.position_name?.trim() || "—"}
            />
            <Field label="Алба / хэлтэс" value={org} />
            <Field label="Имэйл" value={profile?.email?.trim() || "—"} />
          </div>

          <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
            <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Утас
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              placeholder="Утасны дугаар"
            />
            <label className="mt-3 block text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
              Telegram ID
            </label>
            <input
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono"
              placeholder="Жишээ: 123456789"
              inputMode="numeric"
            />
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Telegram бот дээр <code className="text-[11px]">/start</code> эсвэл{" "}
              <code className="text-[11px]">/whoami</code> команд өгч ID-аа авна.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={() => void saveEditable()}
              >
                {saving ? "Хадгалж байна…" : "Хадгалах"}
              </button>
              {message ? (
                <span className="text-sm text-emerald-700">{message}</span>
              ) : null}
              {error ? <span className="text-sm text-rose-600">{error}</span> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
