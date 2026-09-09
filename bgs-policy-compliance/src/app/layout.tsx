import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { IBM_Plex_Sans, Source_Sans_3 } from "next/font/google";
import { ThemeFromPortal } from "@/components/theme-from-portal";
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
  title: "Журмын биелэлт",
  description: "Журам, ажлын байрны биелэлтийн үнэлгээний дотоод систем",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f2937",
};

const THEME_BOOT_SCRIPT = `(function(){try{var q=new URLSearchParams(location.search).get('theme');var t=q||localStorage.getItem('inspect-mn-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mn"
      suppressHydrationWarning
      className={`${sourceSans.variable} ${ibmPlex.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <Script
          id="inspect-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
        <ThemeFromPortal />
        {children}
      </body>
    </html>
  );
}
