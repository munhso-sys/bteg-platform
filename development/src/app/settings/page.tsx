import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/ui/primitives";
import { ThemeToggleButton } from "@/components/theme-toggle";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Тохиргоо"
        subtitle="Судалгаа, хөгжлийн төвийн модулийн тохиргоо"
        actions={<ThemeToggleButton />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Модуль">
          <ul className="space-y-2 text-sm text-[var(--muted)]">
            <li>
              Нэр: <span className="text-[var(--fg)]">Судалгаа хөгжүүлэлт</span>
            </li>
            <li>
              Портал холбоос:{" "}
              <span className="text-[var(--fg)]">/development</span>
            </li>
            <li>
              Загвар: бусад үүргийн модультай ижил — sidebar, KPI карт, хүснэгт
            </li>
          </ul>
        </Panel>
        <Panel title="Мэдээллийн эх">
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
            <li>Хөтөлбөр, үр дүн, тайлан — модулийн дотоод бүртгэл</li>
            <li>
              Судалгааны төслүүд — браузер дээр хадгалагдана, шинэ төсөл нэмж,
              засах, устгах боломжтой
            </li>
            <li>INSPECT-MN Судалгаа, хөгжлийн төвийн бүтэцтэй нийцүүлсэн</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
