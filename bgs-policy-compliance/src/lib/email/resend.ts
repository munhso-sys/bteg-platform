/** Minimal Resend helper for policy document share (server-only). */

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; skipped?: boolean };

function fromAddress() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Inspect Platform <noreply@bteg.inspect.mn>"
  );
}

function resendApiKey() {
  let key = process.env.RESEND_API_KEY?.trim() ?? "";
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(key)) {
    key = key.replace(/^bearer\s+/i, "").trim();
  }
  return key;
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: string }>;
}): Promise<SendEmailResult> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    return { ok: false, skipped: true, error: "RESEND_API_KEY тохируулаагүй" };
  }
  if (!apiKey.startsWith("re_")) {
    return {
      ok: false,
      error: "RESEND_API_KEY буруу формат (re_... байх ёстой).",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: data.message || `Resend алдаа (${res.status})`,
      };
    }
    return { ok: true, id: data.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Email илгээхэд алдаа",
    };
  }
}
