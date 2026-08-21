"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { VoiceNav } from "@/components/voice/VoiceNav";
import type { EmployeeVoiceItem, VoiceNotice } from "@/lib/voice/types";
import { VOICE_TYPE_LABELS } from "@/lib/voice/types";

export default function VoiceNotifyPage() {
  const [items, setItems] = useState<EmployeeVoiceItem[]>([]);
  const [notices, setNotices] = useState<VoiceNotice[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/employee-voice/notices", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) {
      setItems(data.items ?? []);
      setNotices(data.notices ?? []);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function sendAll() {
    const res = await fetch("/api/employee-voice/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto: true }),
    });
    const data = await res.json();
    setMessage(`${data.created?.length ?? 0} мэдэгдэл илгээлээ`);
    await load();
  }

  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <div>
      <PageHeader
        title="Эрсдэл / СХ мэдэгдэл"
        description="Гомдол, өндөр эрсдэл, асуулгыг эрсдэлийн удирдлага болон судалгаа хөгжүүлэлтэд хүргэнэ."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => void load()}>
              <RefreshCw size={14} />
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void sendAll()}>
              Автоматаар мэдэгдэх
            </button>
          </>
        }
      />
      <VoiceNav />
      {message ? <p className="mb-3 text-sm">{message}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/risk-management" className="btn">
          Эрсдэлийн хуудас
        </Link>
        <Link href="/development" className="btn">
          Судалгаа хөгжүүлэлт
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
        <table>
          <thead>
            <tr>
              <th>Огноо</th>
              <th>Очих</th>
              <th>Бүртгэл</th>
              <th>Мессеж</th>
              <th>Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {notices.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-sm text-[var(--muted)]">
                  Мэдэгдэл алга. «Автоматаар мэдэгдэх» дарж гомдол/асуулгыг хүргүүлнэ.
                </td>
              </tr>
            ) : (
              notices.map((n) => {
                const src = itemMap.get(n.voiceId);
                return (
                  <tr key={n.id}>
                    <td className="tabular-nums text-xs">
                      {n.sentAt?.slice(0, 16) || n.createdAt.slice(0, 16)}
                    </td>
                    <td>{n.target === "risk" ? "Эрсдэл" : "СХ"}</td>
                    <td>
                      {src
                        ? `${VOICE_TYPE_LABELS[src.type]} · ${src.title}`
                        : n.voiceId.slice(0, 8)}
                    </td>
                    <td className="text-xs text-[var(--muted)]">{n.message}</td>
                    <td>{n.status === "sent" ? "Илгээсэн" : n.status}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
