"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

export function LogoutButton({
  className,
  label = "Гарах",
  variant = "default",
  onClick,
}: {
  className?: string;
  label?: string;
  variant?: "default" | "ghost" | "sidebar";
  onClick?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    onClick?.();
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.assign("/login");
    } catch {
      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const styles =
    variant === "sidebar"
      ? "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
      : variant === "ghost"
        ? "btn btn-ghost"
        : "btn";

  return (
    <button
      type="button"
      className={cn(styles, className)}
      onClick={handleLogout}
      disabled={loading}
      aria-label="Гарах"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
      <span>{label}</span>
    </button>
  );
}
