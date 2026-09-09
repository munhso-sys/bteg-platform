"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck, ClipboardCheck, ShieldAlert, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const authError = searchParams.get("error") || "";
  const reason = searchParams.get("reason") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    authError ||
      (reason === "idle"
        ? "Идэвхгүй байсан тул системээс автоматаар гарлаа. Дахин нэвтэрнэ үү."
        : ""),
  );
  const [loading, setLoading] = useState(false);

  async function handleLogin(e?: FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "Имэйл эсвэл нууц үг буруу байна."
            : signInError.message,
        );
        return;
      }

      void fetch("/api/usage/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "login",
          module: "portal",
          path: "/login",
          detail: "password",
        }),
        keepalive: true,
      }).catch(() => {
        // non-blocking
      });

      router.replace(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нэвтрэхэд алдаа гарлаа.");
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
            "linear-gradient(180deg, rgba(217, 119, 6, 0.08), transparent 220px), radial-gradient(circle at 12% 18%, rgba(31, 41, 55, 0.08), transparent 28%), radial-gradient(circle at 88% 12%, rgba(217, 119, 6, 0.12), transparent 24%)",
        }}
      />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-md border border-[var(--border)] bg-white shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
        <div className="absolute right-3 top-3 z-20">
          <ThemeToggle compact />
        </div>
        <section className="hidden bg-[var(--sidebar)] px-8 py-10 text-[var(--sidebar-fg)] lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[var(--brand)] text-white">
                <ShieldCheck size={22} />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-wide">
                  INSPECT-MN
                </div>
                <div className="text-[11px] text-white/55">Platform portal</div>
              </div>
            </div>

            <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight">
              Дотоод хяналтын нэгдсэн систем
            </h1>
            <p className="mt-4 max-w-md text-2xl font-semibold leading-tight tracking-tight text-white">
              <span className="text-[var(--brand)] inline-block pl-[4.1rem]">TOOLS АШИГЛАЖ</span>{" "}
              ҮҮРГЭЭ
              <br />
              <span className="inline-block pl-[8.1rem]">
                ҮР ДҮНТЭЙ{" "}
                <span className="text-[var(--brand)]">ХЭРЭГЖҮҮЛЬЕ</span>
              </span>
            </p>
          </div>

          <div className="mt-8 space-y-3">
            {[
              {
                icon: <ClipboardCheck size={18} />,
                title: "Журмаа биелүүлэх",
                desc: "Журмын заалт бүрийг хянах, үнэлэх, залруулга хийх",
              },
              {
                icon: <ShieldAlert size={18} />,
                title: "Эрсдэлээ мэдрэх",
                desc: "Эрсдэлийг илрүүлэх, үнэлгээ хийх, урьдчилан сэргийлэх",
              },
              {
                icon: <BarChart3 size={18} />,
                title: "Ил тодоор удирдах",
                desc: "Тайлан, мэдээлэл, AI дүн шинжилгээ",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2.5"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--brand)]/20 text-[var(--brand)]">
                  {item.icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-white/90">
                    {item.title}
                  </div>
                  <div className="text-[12px] leading-5 text-white/55">
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 py-8 sm:px-8 sm:py-10">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand)] text-white">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold">INSPECT-MN</div>
                <div className="text-[11px] text-[var(--muted)]">
                  Platform portal
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-[var(--fg)]">
            Нэвтрэх
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Байгууллагын портал руу Supabase эрхээр нэвтэрнэ үү.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[var(--fg)]">
                Имэйл
              </span>
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

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[var(--fg)]">
                Нууц үг
              </span>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--fg)]"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Нууц үг нуух" : "Нууц үг харах"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="mt-1.5 flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[var(--brand-dark)] hover:underline"
                >
                  Нууц үг солих
                </Link>
              </div>
            </label>

            {error ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary w-full justify-center"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Нэвтэрч байна..." : "Нэвтрэх"}
            </button>
          </form>

          <div className="mt-5 rounded-md border border-[var(--border)] bg-slate-50 px-3 py-3 text-sm">
            <div className="font-medium text-[var(--fg)]">Нэвтрэх эрх байхгүй юу?</div>
            <p className="mt-1 text-[var(--muted)]">
              Овог нэр, имэйл, утас, алба/хэлтэс, албан тушаалаа илгээнэ үү.
            </p>
            <Link
              href="/access-request"
              className="mt-2 inline-flex text-[var(--brand-dark)] hover:underline"
            >
              Нэвтрэх эрх авах хүсэлт илгээх →
            </Link>
          </div>

          <p className="mt-6 text-center text-[11px] text-[var(--muted)]">
            Protected session · Supabase Auth
          </p>
        </section>
      </div>
    </main>
  );
}
