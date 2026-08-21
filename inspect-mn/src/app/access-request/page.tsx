"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

type Position = { id: string; name: string };
type Alba = { id: string; name: string; positions: Position[] };
type Heltes = { id: string; name: string; albas: Alba[] };

export default function AccessRequestClient() {
  const [heltesList, setHeltesList] = useState<Heltes[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [heltesId, setHeltesId] = useState("");
  const [albaId, setAlbaId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/org/options", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data.ok) {
          setHeltesList(data.heltes ?? []);
        } else if (!cancelled) {
          setError(data.error || "Алба, хэлтэсийн жагсаалт ачаалахад алдаа");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Алдаа");
        }
      } finally {
        if (!cancelled) setLoadingTree(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const albas = useMemo(() => {
    return heltesList.find((h) => h.id === heltesId)?.albas ?? [];
  }, [heltesList, heltesId]);

  const positions = useMemo(() => {
    return albas.find((a) => a.id === albaId)?.positions ?? [];
  }, [albas, albaId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const heltes = heltesList.find((h) => h.id === heltesId);
      const alba = albas.find((a) => a.id === albaId);
      const position = positions.find((p) => p.id === positionId);
      if (!heltes || !alba || !position) {
        setError("Алба, хэлтэс, албан тушаалыг сонгоно уу.");
        return;
      }

      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          heltes_id: heltes.id,
          heltes_name: heltes.name,
          alba_id: alba.id,
          alba_name: alba.name,
          position_id: position.id,
          position_name: position.name,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Илгээхэд алдаа гарлаа");
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Илгээхэд алдаа");
    } finally {
      setSubmitting(false);
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

      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-md border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand)] text-white">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold">Нэвтрэх эрх авах хүсэлт</div>
              <div className="text-[11px] text-[var(--muted)]">
                INSPECT-MN · bteg.inspect.mn
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-8 sm:py-8">
          {done ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-emerald-800">
                Хүсэлт илгээгдлээ. Админ баталсны дараа имэйлээр урилга ирнэ.
              </div>
              <Link href="/login" className="btn btn-primary inline-flex">
                Нэвтрэх хуудас руу буцах
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Овог нэр</span>
                <input
                  className="input"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Батбаяр Дорж"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Имэйл хаяг</span>
                <input
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.mn"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Утасны дугаар</span>
                <input
                  className="input"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="99112233"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Хэлтэс</span>
                <select
                  className="input"
                  required
                  disabled={loadingTree}
                  value={heltesId}
                  onChange={(e) => {
                    setHeltesId(e.target.value);
                    setAlbaId("");
                    setPositionId("");
                  }}
                >
                  <option value="">Сонгох…</option>
                  {heltesList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Алба / нэгж</span>
                <select
                  className="input"
                  required
                  disabled={!heltesId}
                  value={albaId}
                  onChange={(e) => {
                    setAlbaId(e.target.value);
                    setPositionId("");
                  }}
                >
                  <option value="">Сонгох…</option>
                  {albas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Албан тушаал</span>
                <select
                  className="input"
                  required
                  disabled={!albaId}
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                >
                  <option value="">Сонгох…</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">
                  Тэмдэглэл <span className="font-normal text-[var(--muted)]">(заавал биш)</span>
                </span>
                <textarea
                  className="input min-h-[72px]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Нэмэлт мэдээлэл…"
                />
              </label>

              {error ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary w-full justify-center"
                disabled={submitting || loadingTree}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                {submitting ? "Илгээж байна..." : "Хүсэлт илгээх"}
              </button>

              <p className="text-center text-sm text-[var(--muted)]">
                Аль хэдийн эрхтэй юу?{" "}
                <Link href="/login" className="text-[var(--brand-dark)] hover:underline">
                  Нэвтрэх
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
