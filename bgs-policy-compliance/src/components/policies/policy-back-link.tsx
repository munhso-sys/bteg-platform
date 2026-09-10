import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Restore Хэлтэс drawer, or return to Журмууд / Ажлын байр / журмын дэлгэрэнгүй. */
export function contextBackHref(input: {
  from?: string | null;
  heltesId?: string | null;
  albaId?: string | null;
  tab?: string | null;
  policyId?: string | null;
}) {
  if (input.from === "policy" && input.policyId) {
    return `/policies/${input.policyId}`;
  }
  if (input.from === "org" && input.heltesId && input.albaId) {
    const qs = new URLSearchParams({
      heltesId: input.heltesId,
      albaId: input.albaId,
      tab: input.tab === "positions" ? "positions" : "policies",
    });
    return `/org?${qs.toString()}`;
  }
  if (input.from === "org") return "/org";
  if (input.from === "positions") return "/positions";
  return "/policies";
}

export function ContextBackLink({
  from,
  heltesId,
  albaId,
  tab,
  policyId,
  label,
}: {
  from?: string | null;
  heltesId?: string | null;
  albaId?: string | null;
  tab?: string | null;
  policyId?: string | null;
  label?: string;
}) {
  const href = contextBackHref({ from, heltesId, albaId, tab, policyId });
  const text =
    label ??
    (from === "policy" && policyId
      ? "Журмын үнэлгээ рүү буцах"
      : from === "org"
        ? "Хэлтэс рүү буцах"
        : from === "positions"
          ? "Ажлын байр руу буцах"
          : "Журмууд руу буцах");

  return (
    <Link
      href={href}
      title={text}
      aria-label={text}
      className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm text-[var(--fg)] hover:bg-[var(--surface-muted)]"
    >
      <ArrowLeft size={16} />
      <span>Буцах</span>
    </Link>
  );
}

/** @deprecated use ContextBackLink */
export function PolicyBackLink(props: {
  from?: string | null;
  heltesId?: string | null;
  albaId?: string | null;
  tab?: string | null;
  policyId?: string | null;
}) {
  return <ContextBackLink {...props} />;
}

/** @deprecated use contextBackHref */
export function policyBackHref(input: {
  from?: string | null;
  heltesId?: string | null;
  albaId?: string | null;
  tab?: string | null;
  policyId?: string | null;
}) {
  return contextBackHref(input);
}
