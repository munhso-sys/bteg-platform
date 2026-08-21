export type RowStatus = "open" | "in_progress" | "done" | "overdue" | "draft";

export type TableRow = {
  id: string;
  title: string;
  owner: string;
  department: string;
  status: RowStatus;
  priority: "low" | "medium" | "high";
  updatedAt: string;
  dueDate: string;
};

export type Kpi = {
  label: string;
  value: string;
  delta: string;
  tone: "neutral" | "good" | "warn" | "bad";
};

export type ModuleDataset = {
  kpis: Kpi[];
  filters: string[];
  rows: TableRow[];
  detailTitle: string;
  detailBody: string[];
};

const baseRows = (
  prefix: string,
  titles: string[],
): TableRow[] =>
  titles.map((title, i) => ({
    id: `${prefix}-${1000 + i}`,
    title,
    owner: ["Б. Болд", "Д. Сараа", "Г. Энхбаяр", "Н. Оюун", "Т. Бат"][i % 5],
    department: ["ХШХ", "ХАБЭА", "Үйлдвэр", "Хүний нөөц", "Санхүү"][i % 5],
    status: (["open", "in_progress", "done", "overdue", "draft"] as RowStatus[])[
      i % 5
    ],
    priority: (["high", "medium", "low"] as const)[i % 3],
    updatedAt: `2026-08-${String(10 - (i % 7)).padStart(2, "0")}`,
    dueDate: `2026-08-${String(15 + (i % 10)).padStart(2, "0")}`,
  }));

export const DATASETS: Record<string, ModuleDataset> = {
  inspection: {
    kpis: [
      { label: "Шалгалт", value: "28", delta: "6 төлөвлөгөө", tone: "neutral" },
      { label: "Зөрчил", value: "14", delta: "5 шийдвэрлэсэн", tone: "bad" },
      { label: "Нийцэл", value: "86%", delta: "+2%", tone: "good" },
      { label: "Эрсдэл", value: "22%", delta: "-3%", tone: "warn" },
    ],
    filters: ["Бүгд", "Төлөвлөгөө", "Явж буй", "Олдвор", "Засвар"],
    rows: baseRows("IC", [
      "Уурхайн замын аюулгүй байдлын шалгалт",
      "Түлшний агуулахын шалгалт",
      "ХАБЭА-ийн дотоод шалгалт Q3",
      "Баримт бичгийн нийцлийн шалгалт",
      "Гэрээт ажилтны сургалтын шалгалт",
      "Ээлжийн ажиллагааны шалгалт",
    ]),
    detailTitle: "Шалгалтын самбар",
    detailBody: [
      "Төрөл: Төлөвлөгөөт",
      "Хуудас / template: Идэвхтэй",
      "Олдвор: Нээлттэй",
      "Дараагийн алхам: Засвар арга хэмжээ",
    ],
  },
  "policy-compliance": {
    kpis: [
      { label: "Журам", value: "73", delta: "идэвхтэй", tone: "neutral" },
      { label: "Албан тушаал", value: "618", delta: "бүртгэлтэй", tone: "neutral" },
      { label: "Биелэлт", value: "81%", delta: "+4%", tone: "good" },
      { label: "Үнэлгээ", value: "12", delta: "3 ноорог", tone: "warn" },
    ],
    filters: ["Бүгд", "Журам", "Албан тушаал", "Үнэлгээ", "Матриц"],
    rows: baseRows("PC", [
      "Хөдөлмөрийн аюулгүй байдлын журам",
      "Баримт бичгийн эргэлтийн журам",
      "Ажлын байрны тодорхойлолт — ХАБЭА",
      "Хариуцлагын матрицын шинэчлэл",
      "Албадын биелэлтийн үнэлгээ Q3",
      "Зүйлийн нийцлийн шалгалт",
    ]),
    detailTitle: "Журмын биелэлт",
    detailBody: [
      "Хамрах хүрээ: Байгууллагын бүтэц",
      "Үнэлгээ: Явж буй",
      "Холбоос: Албан тушаал ↔ журам",
      "Дараагийн алхам: Үнэлгээ баталгаажуулах",
    ],
  },
  development: {
    kpis: [
      { label: "Хөтөлбөрийн ажил", value: "16", delta: "4 дууссан", tone: "neutral" },
      { label: "Дундаж явц", value: "64%", delta: "+5%", tone: "good" },
      { label: "Анхаарах", value: "3", delta: "хугацаа хэтэрсэн", tone: "bad" },
      { label: "Санал асуулга", value: "5", delta: "2 нээлттэй", tone: "warn" },
    ],
    filters: ["Бүгд", "Судалгаа", "Хөгжүүлэлт", "Сургалт", "Санал"],
    rows: baseRows("RD", [
      "Бүтээмж дээшлүүлэх санаачилга",
      "Цахим шилжилтийн сургалт",
      "Эрсдэл бууруулах судалгаа",
      "Ажилтны санал асуулга Q3",
      "Тунгаалт, дүгнэлтийн багц",
      "Оролцооны хөтөлбөр",
    ]),
    detailTitle: "Судалгаа хөгжүүлэлт",
    detailBody: [
      "Чиглэл: Хөтөлбөрийн самбар",
      "Улирал: Q3 2026",
      "Оролцогч: Хэлтсүүд",
      "Дараагийн алхам: Явц шинэчлэх",
    ],
  },
  "employee-voice": {
    kpis: [
      { label: "Шинэ санал", value: "18", delta: "+4 энэ 7 хоног", tone: "warn" },
      { label: "Хариулсан", value: "72%", delta: "+6%", tone: "good" },
      { label: "Дундаж хариу өдөр", value: "3.2", delta: "-0.4", tone: "good" },
      { label: "Нээлттэй гомдол", value: "7", delta: "2 overdue", tone: "bad" },
    ],
    filters: ["Бүгд", "Санал", "Гомдол", "Асуулга", "Нээлттэй"],
    rows: baseRows("EV", [
      "Ажлын хувцасны хангамж сайжруулах санал",
      "Шөнийн ээлжийн хоолны чанарын гомдол",
      "Сургалтын хуваарь өөрчлөх санал",
      "Аюулгүй байдлын мэдэгдэл ойлгомжгүй",
      "Цахим бүртгэлийн удаашрал",
      "Ажилтны санал асуулга Q3",
    ]),
    detailTitle: "Сонгосон бүртгэл",
    detailBody: [
      "Ангилал: Санал",
      "Эх сурвалж: Дотоод портал",
      "Хариуцсан: Хүний нөөц",
      "Дараагийн алхам: Хэлтэст шилжүүлэх",
    ],
  },
  "risk-management": {
    kpis: [
      { label: "Идэвхтэй эрсдэл", value: "24", delta: "3 шинэ", tone: "warn" },
      { label: "Өндөр зэрэглэл", value: "5", delta: "stable", tone: "bad" },
      { label: "Хяналт хэрэгжсэн", value: "81%", delta: "+3%", tone: "good" },
      { label: "Хугацаа хэтэрсэн", value: "2", delta: "-1", tone: "good" },
    ],
    filters: ["Бүгд", "Өндөр", "Дунд", "Бага", "Хяналт хүлээгдэж буй"],
    rows: baseRows("RM", [
      "Уурхайн замын тоосжилт",
      "Гэрээт ажилтны сургалтын цоорхой",
      "Түлшний агуулахын хяналт",
      "Мэдээллийн нөөцлөлтийн эрсдэл",
      "Шинэ тоног төхөөрөмжийн ашиглалт",
      "ХАБЭА-ийн зөрчлийн давтамж",
    ]),
    detailTitle: "Эрсдэлийн дэлгэрэнгүй",
    detailBody: [
      "Зэрэглэл: Өндөр",
      "Магадлал × нөлөө: 4 × 5",
      "Хяналт: Долоо хоногийн шалгалт",
      "Эзэмшигч: ХАБЭА менежер",
    ],
  },
  "report-analysis": {
    kpis: [
      { label: "Тайлан энэ сар", value: "12", delta: "4 draft", tone: "neutral" },
      { label: "Баталгаажсан", value: "8", delta: "+2", tone: "good" },
      { label: "KPI зөрүү", value: "3", delta: "анхаарах", tone: "warn" },
      { label: "Хуваалцсан", value: "6", delta: "удирдлагад", tone: "neutral" },
    ],
    filters: ["Бүгд", "Сар", "Улирал", "Жил", "Draft"],
    rows: baseRows("RA", [
      "8-р сарын хяналт шалгалтын нэгтгэл",
      "Журмын биелэлтийн Q2 тайлан",
      "Эрсдэлийн чиг хандлага",
      "Ажилтны дуу хоолойн тойм",
      "Засвар арга хэмжээний гүйцэтгэл",
      "Удирдлагын товч мэдээлэл",
    ]),
    detailTitle: "Тайлангийн самбар",
    detailBody: [
      "Төрөл: Сар тутам",
      "Хамрах хүрээ: Бүх модуль",
      "Статус: Хянагдаж буй",
      "Экспорт: PDF / Excel",
    ],
  },
  "ai-assistant": {
    kpis: [
      { label: "Өнөөдрийн асуулт", value: "41", delta: "+12", tone: "neutral" },
      { label: "Ашигласан хэрэглэгч", value: "19", delta: "+3", tone: "good" },
      { label: "Амжилттай хариу", value: "93%", delta: "+1%", tone: "good" },
      { label: "Хүлээгдэж буй review", value: "4", delta: "prompt", tone: "warn" },
    ],
    filters: ["Бүгд", "ХШ", "Журам", "Эрсдэл", "Тайлан"],
    rows: baseRows("AI", [
      "Олдворын ангилал зөвлөх",
      "Журмын зүйл хайх",
      "Эрсдэлийн матриц тайлбарлах",
      "Тайлангийн товчлол",
      "Засвар арга хэмжээний загвар",
      "Хэрэглэгчийн эрх зөвлөмж",
    ]),
    detailTitle: "AI сесс",
    detailBody: [
      "Загвар: Placeholder (Supabase + LLM дараа)",
      "Контекст: Модулийн өгөгдөл",
      "Хязгаарлалт: Зөвхөн дотоод мэдээлэл",
      "Аудит: Лог хадгалагдана",
    ],
  },
  settings: {
    kpis: [
      { label: "Идэвхтэй интеграци", value: "3", delta: "1 draft", tone: "neutral" },
      { label: "Мэдэгдэл", value: "ON", delta: "email+app", tone: "good" },
      { label: "Орчны тохиргоо", value: "Dev", delta: "local", tone: "warn" },
      { label: "Нөөцлөлт", value: "OK", delta: "өдөр бүр", tone: "good" },
    ],
    filters: ["Ерөнхий", "Интеграци", "Мэдэгдэл", "Аюулгүй байдал"],
    rows: baseRows("ST", [
      "Supabase холболт",
      "Inspection Center URL",
      "Policy Compliance URL",
      "Development module URL",
      "Мэдэгдлийн хуваарь",
      "Сессийн хугацаа",
    ]),
    detailTitle: "Тохиргооны самбар",
    detailBody: [
      "Орчин: Local development",
      "Deploy: Vercel (бэлтгэл)",
      "Нууц түлхүүр: .env.local",
      "Өөрчлөлт: Хадгалах шаардлагатай",
    ],
  },
  "management-center": {
    kpis: [
      { label: "Хэрэглэгч", value: "36", delta: "+2", tone: "neutral" },
      { label: "Админ", value: "4", delta: "stable", tone: "neutral" },
      { label: "Идэвхтэй сесс", value: "11", delta: "одоо", tone: "good" },
      { label: "Аудит лог", value: "128", delta: "7 хоног", tone: "neutral" },
    ],
    filters: ["Хэрэглэгч", "Эрх", "Аудит", "Модуль хандалт"],
    rows: baseRows("MC", [
      "ХШХ менежер эрх шинэчлэх",
      "Шинэ аудиторын бүртгэл",
      "Модуль хандалтын матриц",
      "Нэвтрэлтийн лог шалгах",
      "Үүргийн бүлэг үүсгэх",
      "Гадна интеграцийн эрх",
    ]),
    detailTitle: "Удирдлагын үйлдэл",
    detailBody: [
      "Үүрэг: Platform admin",
      "Хамрах хүрээ: Бүх модуль",
      "Сүүлд нэвтэрсэн: 2026-08-11",
      "Дараагийн алхам: Эрх баталгаажуулах",
    ],
  },
};

export const DASHBOARD_STATS = [
  { label: "Идэвхтэй модуль", value: "9" },
  { label: "Нээлттэй ажил", value: "47" },
  { label: "Анхаарах", value: "9" },
  { label: "Өнөөдрийн шинэчлэлт", value: "14" },
];
