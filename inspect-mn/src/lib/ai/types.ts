export type AiChatModule =
  | "general"
  | "inspection"
  | "policy"
  | "development"
  | "voice"
  | "risk"
  | "smartmine"
  | "reports";

export type AiChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};
