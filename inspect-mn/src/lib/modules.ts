import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ClipboardCheck,
  Factory,
  FileBarChart2,
  FileCheck2,
  FileSearch,
  FlaskConical,
  ListTodo,
  Megaphone,
  Network,
  Settings,
  ShieldAlert,
  LayoutDashboard,
} from "lucide-react";

export type ModuleGroup = "duty" | "result" | "tools";

export type PlatformModule = {
  id: string;
  href: string;
  label: string;
  description: string;
  group: ModuleGroup;
  icon: LucideIcon;
};

export const GROUP_LABELS: Record<ModuleGroup, string> = {
  duty: "ҮҮРЭГ",
  result: "ҮР ДҮН",
  tools: "TOOLS",
};

export const GROUP_HINTS: Record<ModuleGroup, string> = {
  duty: "Гол үүргийн модулиуд",
  result: "Үр дүнгийн модулиуд",
  tools: "Хэрэгсэл, тохиргоо",
};

export const MODULES: PlatformModule[] = [
  {
    id: "inspection",
    href: "/inspection",
    label: "Хяналт шалгалт",
    description: "Шалгалтын төлөвлөгөө, явц, олдвор, засвар арга хэмжээ",
    group: "duty",
    icon: ClipboardCheck,
  },
  {
    id: "policy-compliance",
    href: "/policy-compliance",
    label: "Журмын биелэлт",
    description: "Журам, ажлын байр, биелэлтийн үнэлгээ",
    group: "duty",
    icon: FileCheck2,
  },
  {
    id: "guidance",
    href: "/guidance",
    label: "Удирдамж",
    description: "Удирдамжийн ажил төлөвлөх, гүйцэтгэх, явц болон үр дүн бүртгэх",
    group: "duty",
    icon: ListTodo,
  },
  {
    id: "development",
    href: "/development",
    label: "Судалгаа хөгжүүлэлт",
    description: "Судалгаа, хөгжүүлэлт, сургалт, санал асуулга",
    group: "duty",
    icon: FlaskConical,
  },
  {
    id: "process",
    href: "/process",
    label: "Процесс",
    description: "PFD процесс мод — журам, шалгалт, зөрчил, эрсдэл, дуу хоолойн суурь",
    group: "duty",
    icon: Network,
  },
  {
    id: "employee-voice",
    href: "/employee-voice",
    label: "Ажилтны дуу хоолой",
    description: "Санал, хүсэлт, гомдол, асуулга · Telegram · хариу арга хэмжээ",
    group: "result",
    icon: Megaphone,
  },
  {
    id: "risk-management",
    href: "/risk-management",
    label: "Эрсдэлийн удирдлага",
    description: "Бүртгэл, матриц, засвар, эх үүсвэр, хавтас",
    group: "result",
    icon: ShieldAlert,
  },
  {
    id: "report-analysis",
    href: "/report-analysis",
    label: "Тайлан шинжилгээ",
    description: "ДХШХ нэгдсэн удирдлага — KPI, шинжилгээ, хавтас, Excel/PDF",
    group: "result",
    icon: FileBarChart2,
  },
  {
    id: "smartmine",
    href: "/smartmine",
    label: "SmartMine",
    description: "Боловсруулалт, тоног төхөөрөмж, засвар, MTTR / downtime",
    group: "result",
    icon: Factory,
  },
  {
    id: "ai-assistant",
    href: "/ai-assistant",
    label: "AI туслах",
    description: "Асуулт хариулт, товчлол, зөвлөмж",
    group: "tools",
    icon: Bot,
  },
  {
    id: "policy-review",
    href: "/policy-review",
    label: "Баримт харьцуулалт",
    description: "Журам, заалтын ялгаа, зөрчил, дутуу болон давхардлыг эшлэлтэй шалгах",
    group: "tools",
    icon: FileSearch,
  },
  {
    id: "settings",
    href: "/settings",
    label: "Тохиргоо",
    description: "Системийн тохиргоо, интеграци, мэдэгдэл",
    group: "tools",
    icon: Settings,
  },
  {
    id: "management-center",
    href: "/management-center",
    label: "Удирдлагын төв",
    description: "Хэрэглэгч, эрх, модуль хандалт, системийн самбар",
    group: "tools",
    icon: LayoutDashboard,
  },
];

export function modulesByGroup(group: ModuleGroup) {
  return MODULES.filter((m) => m.group === group);
}

export function getModule(href: string) {
  return MODULES.find((m) => m.href === href);
}
