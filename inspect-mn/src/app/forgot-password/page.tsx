"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Имэйл хаягаа оруулна уу.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.error || "Илгээхэд алдаа гарлаа.");
        return;
      }

      setMessage(
        data.message ||
          "Хэрэв энэ имэйлээр бүртгэлтэй бол нууц үг шинэчлэх холбоос илгээгдлээ.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(217, 119, 6, 0.08), transparent 220px), radial-gradient(circle at 12% 18%, rgba(31, 41, 55, 0.08), transparent 28%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-md border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] bg-[var(--sidebar)] px-6 py-5 text-[var(--sidebar-fg)]">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand)] text-white">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold">INSPECT-MN</div>
              <div className="text-[11px] text-white/55">Нууц үг сэргээх</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-7">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--fg)]">
            Нууц үг солих
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Бүртгэлтэй имэйлээ оруулна уу. Шинэчлэх холбоос имэйлд очно.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Имэйл</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.mn"
              />
            </label>

            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary w-full justify-center"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Илгээж байна..." : "Холбоос илгээх"}
            </button>
          </form>

          <Link
            href="/login"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-[var(--brand-dark)] hover:underline"
          >
            <ArrowLeft size={14} /> Нэвтрэх хуудас руу буцах
          </Link>
        </div>
      </div>
    </main>
  );
}
