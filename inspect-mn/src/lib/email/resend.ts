type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: string;
  }>;
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; skipped?: boolean };

function fromAddress() {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Inspect Platform <noreply@bteg.inspect.mn>"
  );
}

/** Normalize Resend API key from env (strip quotes / Bearer / whitespace). */
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
  // Accidental paste of whole JSON: extract token field
  if (key.startsWith("{") && key.includes('"token"')) {
    try {
      const parsed = JSON.parse(key) as { token?: string };
      if (parsed.token) key = String(parsed.token).trim();
    } catch {
      // keep as-is
    }
  }
  return key;
}

/** Send transactional email via Resend. Skips if RESEND_API_KEY is missing. */
export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const apiKey = resendApiKey();
  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      error: "RESEND_API_KEY тохируулаагүй",
    };
  }
  if (!apiKey.startsWith("re_")) {
    return {
      ok: false,
      error:
        "RESEND_API_KEY буруу формат. Зөвхөн re_... token байх ёстой (JSON/id биш).",
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
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        error: json.message || json.name || `Resend HTTP ${res.status}`,
      };
    }
    return { ok: true, id: json.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Имэйл илгээхэд алдаа",
    };
  }
}

export function inviteEmailHtml(params: {
  fullName: string;
  inviteUrl: string;
  siteUrl: string;
}) {
  const name = params.fullName.trim() || "Хэрэглэгч";
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px">Inspect Platform</h2>
      <p>Сайн байна уу, <strong>${escapeHtml(name)}</strong>.</p>
      <p>Нууц үгээ тохируулах / шинэчлэх бол доорх товчийг дарна уу.</p>
      <p style="margin:20px 0">
        <a href="${params.inviteUrl}"
           style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">
          Нууц үг тохируулах
        </a>
      </p>
      <p style="font-size:13px;color:#64748b">Холбоос ажиллахгүй бол:<br/>
        <span style="word-break:break-all">${escapeHtml(params.inviteUrl)}</span>
      </p>
      <p style="font-size:12px;color:#94a3b8;margin-top:24px">${escapeHtml(params.siteUrl)}</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
