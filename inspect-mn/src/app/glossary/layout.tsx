import { GlossaryNav } from "@/components/glossary/GlossaryNav";

export default function GlossaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <GlossaryNav />
      {children}
    </div>
  );
}
