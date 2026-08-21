/**
 * Build an app-hosted recovery/invite URL from admin.generateLink().
 * Prefer token_hash over Supabase-hosted action_link so the browser hits
 * /auth/callback with query params (server can verifyOtp). Hash-fragment
 * redirects from /auth/v1/verify never reach the server.
 */
export function appAuthLinkFromGenerate(params: {
  siteUrl: string;
  hashedToken?: string | null;
  type: "recovery" | "invite" | "magiclink" | "signup";
  next?: string;
  fallbackActionLink?: string | null;
}) {
  const site = params.siteUrl.replace(/\/$/, "");
  const next = params.next?.startsWith("/")
    ? params.next
    : "/update-password";

  if (params.hashedToken) {
    const q = new URLSearchParams({
      token_hash: params.hashedToken,
      type: params.type === "invite" ? "invite" : params.type,
      next,
    });
    return `${site}/auth/callback?${q.toString()}`;
  }

  return params.fallbackActionLink || null;
}
