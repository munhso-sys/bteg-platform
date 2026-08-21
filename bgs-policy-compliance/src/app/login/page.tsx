import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui/primitives";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <PageHeader
          title="Журмын биелэлт"
          description="Дотоод нэвтрэх хуудас"
        />
        <Panel>
          <form className="space-y-3 text-sm" action="/dashboard">
            <label className="block">
              <span className="text-xs text-slate-500">И-мэйл</span>
              <input
                type="email"
                defaultValue="admin@bgs.local"
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">Нууц үг</span>
              <input
                type="password"
                defaultValue="demo"
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
            <button className="w-full rounded bg-slate-900 px-3 py-2 text-white">
              Хянах самбар руу үргэлжлүүлэх
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Нэвтрэлт одоогоор шаардахгүй.{" "}
            <Link href="/org" className="underline">
              Шууд нэвтрэх
            </Link>
          </p>
        </Panel>
      </div>
    </div>
  );
}
