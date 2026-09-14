import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { PortalSessionBridge } from "@/components/PortalSessionBridge";
import { ShellFrame } from "@/components/layout/ShellFrame";
import { ThemeFromPortal } from "@/components/theme-from-portal";
import "./globals.css";

export const metadata: Metadata = {
  title: "Процесс модуль",
  description:
    "PFD / BPMN process tree — central backbone for internal control modules",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#134e4a",
};

const THEME_BOOT_SCRIPT = `(function(){try{var q=new URLSearchParams(location.search).get('theme');var t=q||localStorage.getItem('inspect-mn-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full font-sans">
        <Script
          id="inspect-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
        <ThemeFromPortal />
        <PortalSessionBridge />
        <Suspense
          fallback={
            <div className="flex min-h-[100dvh]">
              <main className="min-w-0 flex-1 overflow-auto p-4">{children}</main>
            </div>
          }
        >
          <ShellFrame>{children}</ShellFrame>
        </Suspense>
      </body>
    </html>
  );
}
