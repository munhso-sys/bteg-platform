/**
 * Catalog of module → sidebar menus (and optional submenus) for Role эрх UI.
 * menu id = route href used by the module sidebar when applicable.
 */

export type ModuleSubmenu = {
  id: string;
  label: string;
};

export type ModuleMenu = {
  id: string;
  label: string;
  children?: ModuleSubmenu[];
};

export type ModuleMenuCatalogEntry = {
  moduleId: string;
  label: string;
  menus: ModuleMenu[];
};

export const MODULE_MENU_CATALOG: ModuleMenuCatalogEntry[] = [
  {
    moduleId: "portal",
    label: "Портал (үндсэн цэс)",
    menus: [
      { id: "inspection", label: "Хяналт шалгалт" },
      { id: "policy-compliance", label: "Журмын биелэлт" },
      { id: "guidance", label: "Удирдамж" },
      { id: "development", label: "Судалгаа хөгжүүлэлт" },
      { id: "process", label: "Процесс" },
      { id: "employee-voice", label: "Ажилтны дуу хоолой" },
      { id: "risk-management", label: "Эрсдэлийн удирдлага" },
      { id: "report-analysis", label: "Тайлан шинжилгээ" },
      { id: "smartmine", label: "SmartMine" },
      { id: "ai-assistant", label: "AI туслах" },
      { id: "policy-review", label: "Баримт харьцуулалт" },
      { id: "glossary", label: "Толь бичиг" },
      { id: "settings", label: "Тохиргоо" },
      { id: "management-center", label: "Удирдлагын төв" },
    ],
  },
  {
    moduleId: "inspection",
    label: "Хяналт шалгалт",
    menus: [
      { id: "/dashboard", label: "Самбар" },
      {
        id: "/plans",
        label: "Шалгалтын төлөвлөгөө",
        children: [
          { id: "/plans", label: "Тойм" },
          { id: "/plans/by-type", label: "Төрлөөр" },
          { id: "/plans/annual", label: "Хуудсаар" },
          { id: "/plans/gaps", label: "Үлдсэн" },
        ],
      },
      { id: "/runs", label: "Шалгалтын гүйцэтгэл" },
      { id: "/templates", label: "Хяналтын хуудсууд" },
      {
        id: "/findings",
        label: "Зөрчлүүд",
        children: [
          { id: "/findings", label: "Тойм" },
          { id: "/findings/state", label: "Төрийн ХШ" },
          { id: "/findings/night", label: "Шөнийн ХШ" },
          { id: "/findings/joint", label: "Хамтарсан ХШ" },
        ],
      },
      {
        id: "/actions",
        label: "Засах арга хэмжээ",
        children: [
          { id: "/actions", label: "Тойм" },
          { id: "/actions/open", label: "Арилаагүй" },
          { id: "/actions/resolved", label: "Арилсан" },
        ],
      },
      { id: "/evidence", label: "Нотлох баримт" },
      { id: "/analytics", label: "Шинжилгээ" },
      { id: "/imports", label: "Импорт" },
      {
        id: "/settings",
        label: "Тохиргоо",
        children: [
          { id: "/settings", label: "Ерөнхий" },
          { id: "/settings/org-templates", label: "Алба · ХШ хуудас холбох" },
          { id: "/settings/data", label: "Өгөгдөл" },
        ],
      },
    ],
  },
  {
    moduleId: "settings",
    label: "Портал тохиргоо",
    menus: [
      { id: "/settings/profile", label: "Миний профайл" },
      { id: "/settings", label: "Ерөнхий" },
      { id: "/settings/access-requests", label: "Нэвтрэх хүсэлт" },
      { id: "/settings/users", label: "Хэрэглэгч / Role" },
      { id: "/settings/roles", label: "Role эрх" },
      { id: "/settings/temp-grants", label: "Хугацаатай эрх" },
      { id: "/settings/session", label: "Сесс / Auto logout" },
    ],
  },
  {
    moduleId: "risk-management",
    label: "Эрсдэлийн удирдлага",
    menus: [
      { id: "/risk-management", label: "Самбар" },
      { id: "/risk-management/register", label: "Бүртгэл" },
      { id: "/risk-management/matrix", label: "Матриц" },
      { id: "/risk-management/work", label: "Засвар" },
      { id: "/risk-management/sources", label: "Эх үүсвэр" },
      { id: "/risk-management/tree", label: "Хавтас" },
    ],
  },
  {
    moduleId: "policy-compliance",
    label: "Журмын биелэлт",
    menus: [
      { id: "/dashboard", label: "Хянах самбар" },
      { id: "/org", label: "Алба, хэлтэс" },
      {
        id: "/policies",
        label: "Журмууд",
        children: [
          { id: "/policies", label: "Удирдлага" },
          { id: "/policies/review", label: "Шалгах" },
        ],
      },
      {
        id: "/positions",
        label: "Ажлын байр",
        children: [
          { id: "/positions", label: "Удирдлага" },
          { id: "/positions/review", label: "Шалгах" },
        ],
      },
      { id: "/matrix", label: "Холбоосын хүснэгт" },
      { id: "/evaluations", label: "Үнэлгээ" },
      { id: "/imports", label: "Импорт" },
      {
        id: "/settings",
        label: "Тохиргоо",
        children: [
          { id: "/settings", label: "Ерөнхий" },
          { id: "/settings/org-structure", label: "Байгууллага · нэгж" },
          { id: "/settings/org-policies", label: "Алба · журам холбох" },
          { id: "/settings/data", label: "Өгөгдөл" },
        ],
      },
    ],
  },
  {
    moduleId: "process",
    label: "Процесс",
    menus: [
      { id: "/dashboard", label: "Самбар" },
      { id: "/processes", label: "Процессын зураг" },
      { id: "/documents", label: "Диаграмм · баримт" },
      { id: "/nodes", label: "Зангилаанууд" },
      { id: "/settings", label: "Тохиргоо" },
    ],
  },
  {
    moduleId: "development",
    label: "Судалгаа хөгжүүлэлт",
    menus: [
      { id: "/dashboard", label: "Самбар" },
      { id: "/projects", label: "Судалгааны төслүүд" },
      { id: "/program", label: "Хөтөлбөрийн ажил" },
      { id: "/results", label: "Туршилт, үр дүн" },
      { id: "/reports", label: "Судалгааны тайлан" },
      { id: "/feedback", label: "Санал асуулга" },
      { id: "/settings", label: "Тохиргоо" },
    ],
  },
  {
    moduleId: "employee-voice",
    label: "Ажилтны дуу хоолой",
    menus: [
      { id: "/employee-voice", label: "Үндсэн" },
      { id: "/employee-voice/inbox", label: "Inbox" },
      { id: "/employee-voice/actions", label: "Арга хэмжээ" },
      { id: "/employee-voice/process", label: "Процесс" },
      { id: "/employee-voice/notify", label: "Мэдэгдэл" },
      { id: "/employee-voice/telegram", label: "Telegram" },
    ],
  },
  {
    moduleId: "report-analysis",
    label: "Тайлан шинжилгээ",
    menus: [{ id: "/report-analysis", label: "Үндсэн" }],
  },
  {
    moduleId: "guidance",
    label: "Удирдамж",
    menus: [
      { id: "/guidance", label: "Үндсэн" },
      { id: "/guidance/other", label: "Бусад" },
    ],
  },
];

export function getModuleMenuCatalog(moduleId: string) {
  return MODULE_MENU_CATALOG.find((m) => m.moduleId === moduleId) ?? null;
}
