"use client";

import { Calendar } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Native date input with a single theme-aware calendar icon. */
export function DateInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <div className="relative">
      <input
        type="date"
        {...props}
        className={cn("date-input mt-0 w-full pr-9", className)}
      />
      <Calendar
        size={16}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 z-0 -translate-y-1/2 text-[var(--muted)]"
      />
    </div>
  );
}
