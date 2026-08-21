import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--background)] text-sm text-[var(--muted)]">
          Уншиж байна...
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
