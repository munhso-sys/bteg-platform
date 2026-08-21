export function escapeTelegramHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function telegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
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

export function portalPublicUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://bteg.inspect.mn"
  ).replace(/\/$/, "");
}
