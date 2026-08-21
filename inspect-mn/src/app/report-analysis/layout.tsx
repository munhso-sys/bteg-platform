import type { ReactNode } from "react";

export const metadata = {
  title: "Тайлан шинжилгээ",
  description: "ДХШХ-ийн үйл ажиллагааны нэгдсэн удирдлага",
};

export default function ReportAnalysisLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
