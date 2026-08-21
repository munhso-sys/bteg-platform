import type { ReactNode } from "react";

/** Settings segment layout — profile is open to all users; admin pages self-guard. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
