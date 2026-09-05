"use client";

/**
 * Broadcast portal logout to duty-module iframes so client storage can clear (RD-D02).
 */
export const INSPECT_LOGOUT_EVENT = "inspect-portal-logout";

export function broadcastPortalLogout() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INSPECT_LOGOUT_EVENT));
}
