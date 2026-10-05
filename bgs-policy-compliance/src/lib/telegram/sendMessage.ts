export function escapeTelegramHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function telegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const token = telegramToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN тохируулаагүй");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function sendTelegramDocument(input: {
  chatId: string;
  filename: string;
  bytes: Buffer;
  caption?: string;
  contentType?: string;
}) {
  const token = telegramToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN тохируулаагүй");

  const form = new FormData();
  form.append("chat_id", input.chatId);
  if (input.caption) {
    form.append("caption", input.caption.slice(0, 1024));
    form.append("parse_mode", "HTML");
  }
  const blob = new Blob([new Uint8Array(input.bytes)], {
    type: input.contentType || "application/octet-stream",
  });
  form.append("document", blob, input.filename);

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendDocument`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}
