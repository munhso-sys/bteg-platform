import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { IBM_Plex_Sans, Source_Sans_3 } from "next/font/google";
import { ShellFrame } from "@/components/layout/ShellFrame";
import { ThemeFromPortal } from "@/components/theme-from-portal";
import { ensureStoreHydrated } from "@/lib/store";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin", "cyrillic"],
});

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Хяналт шалгалтын төв",
  description:
    "Хяналт шалгалтын төв — хяналтын хуудас, гүйцэтгэл, зөрчил, засах арга хэмжээ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f2937",
};

/** Allow cold hydrate of the inspection store on Vercel. */
export const maxDuration = 60;

const THEME_BOOT_SCRIPT = `(function(){try{var q=new URLSearchParams(location.search).get('theme');var t=q||localStorage.getItem('inspect-mn-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureStoreHydrated();

  return (
    <html
      lang="mn"
      suppressHydrationWarning
      className={`${sourceSans.variable} ${ibmPlex.variable} h-full`}
    >
      <body className="h-full antialiased">
        <Script
          id="inspect-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
        <ThemeFromPortal />
        <Suspense
          fallback={
            <div className="flex min-h-[100dvh]">
              <main className="min-w-0 flex-1 overflow-auto">
                <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-5">
                  {children}
                </div>
              </main>
            </div>
          }
        >
          <ShellFrame>{children}</ShellFrame>
        </Suspense>
      </body>
    </html>
  );
}
