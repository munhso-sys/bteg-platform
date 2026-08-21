import type { VoicePriority, VoiceType } from "@/lib/voice/types";

export function classifyVoiceText(text: string): {
  type: VoiceType;
  priority: VoicePriority;
} {
  const lower = text.toLowerCase();

  if (
    lower.includes("гомдол") ||
    lower.includes("шударга бус") ||
    lower.includes("дарамт") ||
    lower.includes("асуудал")
  ) {
    return { type: "complaint", priority: "high" };
  }
  if (
    lower.includes("асуулга") ||
    lower.includes("судалгаа") ||
    lower.includes("санал асуулга")
  ) {
    return { type: "survey", priority: "medium" };
  }
  if (
    lower.includes("хүсэлт") ||
    lower.includes("хүсье") ||
    lower.includes("олгох") ||
    lower.includes("нэмэх")
  ) {
    return { type: "request", priority: "medium" };
  }
  if (
    lower.includes("эрсдэл") ||
    lower.includes("аюул") ||
    lower.includes("осол") ||
    lower.includes("гал")
  ) {
    return { type: "complaint", priority: "critical" };
  }
  return { type: "suggestion", priority: "medium" };
}

export function predictAction(input: {
  type: VoiceType;
  priority: VoicePriority;
  title: string;
}) {
  if (input.priority === "critical" || input.type === "complaint") {
    return {
      title: "Шуурхай шалгалт, хариуцагч томилох",
      note: `${input.title} — гомдол/өндөр эрсдэлийг 72 цагийн дотор шалгаж, эрсдэлийн модульд мэдэгдэнэ.`,
      notifyRisk: true,
      notifyResearch: false,
    };
  }
  if (input.type === "survey") {
    return {
      title: "Асуулгын хариуг нэгтгэж СХ-д хүргүүлэх",
      note: "Судалгааны дүнг боловсруулж, судалгаа хөгжүүлэлтийн төсөлд холбоно.",
      notifyRisk: false,
      notifyResearch: true,
    };
  }
  if (input.type === "request") {
    return {
      title: "Хүсэлтийг хариуцах нэгжид шилжүүлэх",
      note: "Хугацаа, хариуцагч тогтоож гүйцэтгэлийг хянана.",
      notifyRisk: false,
      notifyResearch: false,
    };
  }
  return {
    title: "Саналыг хэлэлцэж сайжруулалтын төлөвлөгөөнд оруулах",
    note: "Хэрэгжих боломжийг үнэлж, шаардлагатай бол СХ модульд мэдэгдэнэ.",
    notifyRisk: false,
    notifyResearch: input.priority === "high",
  };
}

export function shouldNotifyRisk(item: {
  type: VoiceType;
  priority: VoicePriority;
  notifyRisk: boolean;
  title: string;
  description: string;
}) {
  if (item.notifyRisk) return true;
  if (item.priority === "critical") return true;
  if (item.type === "complaint" && item.priority === "high") return true;
  const blob = `${item.title} ${item.description}`.toLowerCase();
  return ["эрсдэл", "аюул", "осол", "гал", "хабэа"].some((k) => blob.includes(k));
}

export function shouldNotifyResearch(item: {
  type: VoiceType;
  notifyResearch: boolean;
}) {
  return item.notifyResearch || item.type === "survey" || item.type === "suggestion";
}
