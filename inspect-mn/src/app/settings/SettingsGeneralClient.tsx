"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Health = {
  ok: boolean;
  projectRef?: string | null;
  url?: string | null;
  projectName?: string;
  error?: string;
};

export default function SettingsGeneralClient() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);

      const res = await fetch("/api/supabase/health", { cache: "no-store" });
      const data = (await res.json()) as Health;
      setHealth(data);
    } catch (err) {
      setHealth({
        ok: false,
        error: err instanceof Error ? err.message : "Health check failed",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div>
      <PageHeader
        title="Тохиргоо"
        description="Системийн тохиргоо, хэрэглэгчийн эрх, нэвтрэх хүсэлт."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} /> Холболт шалгах
          </button>
        }
      />

      <SettingsNav />

      <section className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <Link
          href="/settings/access-requests"
          className="rounded-md border border-[var(--border)] bg-white px-3 py-3 text-sm hover:border-[var(--brand)]"
        >
          <div className="font-semibold">Нэвтрэх хүсэлт</div>
          <div className="mt-1 text-[var(--muted)]">Хүсэлт батлах / татгалзах</div>
        </Link>
        <Link
          href="/settings/users"
          className="rounded-md border border-[var(--border)] bg-white px-3 py-3 text-sm hover:border-[var(--brand)]"
        >
          <div className="font-semibold">Хэрэглэгч / Role</div>
          <div className="mt-1 text-[var(--muted)]">Хэрэглэгчид role оноох</div>
        </Link>
        <Link
          href="/settings/roles"
          className="rounded-md border border-[var(--border)] bg-white px-3 py-3 text-sm hover:border-[var(--brand)]"
        >
          <div className="font-semibold">Role эрх</div>
          <div className="mt-1 text-[var(--muted)]">Нэмэлт эрх сонгох</div>
        </Link>
        <Link
          href="/settings/temp-grants"
          className="rounded-md border border-[var(--border)] bg-white px-3 py-3 text-sm hover:border-[var(--brand)]"
        >
          <div className="font-semibold">Хугацаатай эрх</div>
          <div className="mt-1 text-[var(--muted)]">Засах эрхийг хугацаагаар олгох</div>
        </Link>
        <Link
          href="/settings/session"
          className="rounded-md border border-[var(--border)] bg-white px-3 py-3 text-sm hover:border-[var(--brand)]"
        >
          <div className="font-semibold">Сесс / Auto logout</div>
          <div className="mt-1 text-[var(--muted)]">
            Идэвхгүй байдлын дараа автоматаар гарах
          </div>
        </Link>
      </section>

      <section className="mb-4 rounded-md border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-3 py-2">
          <h2 className="text-sm font-semibold">Нэвтэрсэн хэрэглэгч</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="text-[var(--muted)]">{email ?? "—"}</div>
          <LogoutButton />
        </div>
      </section>

      <section className="mb-4 rounded-md border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-3 py-2">
          <h2 className="text-sm font-semibold">Supabase холболт</h2>
        </div>
        <div className="p-4 text-sm">
          {loading ? (
            <p className="text-[var(--muted)]">Шалгаж байна…</p>
          ) : health?.ok ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} />
              <div>
                <div className="font-semibold text-emerald-700">Холбогдсон</div>
                <div className="mt-1 text-[var(--muted)]">
                  Project: {health.projectName ?? "—"}
                </div>
                <div className="mt-1 font-mono text-xs text-[var(--muted)]">
                  ref: {health.projectRef}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 text-rose-600" size={18} />
              <div>
                <div className="font-semibold text-rose-700">Холбогдоогүй</div>
                <div className="mt-1 text-[var(--muted)]">
                  {health?.error ?? "Unknown error"}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
