"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function bootstrap() {
      // Legacy emails may land with #access_token=...&type=recovery
      if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (mounted && session?.user) {
          setEmail(session.user.email ?? "");
          setReady(true);
          setChecking(false);
          window.history.replaceState({}, "", "/update-password");
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        setEmail(session.user.email ?? "");
        setReady(true);
        setChecking(false);
        return;
      }

      setChecking(false);
      setError(
        "Нууц үг сэргээх session олдсонгүй. Имэйл дэх холбоосоор дахин оролдоно уу.",
      );
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (
        (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") &&
        session?.user
      ) {
        setEmail(session.user.email ?? "");
        setReady(true);
        setChecking(false);
        setError("");
      }
    });

    void bootstrap();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!ready) {
      setError("Session хүчингүй байна. Шинэ холбоос авна уу.");
      return;
    }
    if (password.length < 8) {
      setError("Нууц үг хамгийн багадаа 8 тэмдэгттэй байна.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Нууц үг баталгаажуулалттай тохирохгүй байна.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess("Нууц үг амжилттай солигдлоо.");
      window.setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 900);
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
            "linear-gradient(180deg, rgba(217, 119, 6, 0.08), transparent 220px), radial-gradient(circle at 88% 12%, rgba(217, 119, 6, 0.12), transparent 24%)",
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
              <div className="text-[11px] text-white/55">Шинэ нууц үг</div>
            </div>
          </div>
        </div>

        <div className="px-6 py-7">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--fg)]">
            Шинэ нууц үг тохируулах
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {email
              ? `${email} хэрэглэгчийн нууц үгийг шинэчилнэ.`
              : "Имэйл холбоосоор орж ирсэн session-оор нууц үгээ солино."}
          </p>

          {checking ? (
            <div className="mt-8 flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 size={16} className="animate-spin" /> Session шалгаж
              байна…
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Шинэ нууц үг</span>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Хамгийн багадаа 8 тэмдэгт"
                    disabled={!ready}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[var(--muted)] hover:bg-slate-100"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Нууц үг харах/нуух"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">
                  Нууц үг баталгаажуулах
                </span>
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={!ready}
                />
              </label>

              {error ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  {success}
                </div>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary w-full justify-center"
                disabled={loading || !ready}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? "Хадгалж байна..." : "Нууц үг хадгалах"}
              </button>
            </form>
          )}

          <Link
            href="/login"
            className="mt-5 inline-flex text-sm text-[var(--brand-dark)] hover:underline"
          >
            Нэвтрэх хуудас руу буцах
          </Link>
        </div>
      </div>
    </main>
  );
}
