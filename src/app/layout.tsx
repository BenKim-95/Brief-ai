import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import { BusyOverlay } from "@/components/busy-overlay";
import { ErrorReporter } from "@/components/error-reporter";
import { NativeLinkHandler } from "@/components/native-link-handler";
import { NavigationProgress } from "@/components/navigation-progress";
import { PwaClient } from "@/components/pwa-client";
import "./globals.css";

const plex = IBM_Plex_Sans_KR({
  variable: "--font-sans",
  weight: ["400", "500", "700"],
  display: "swap",
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
});

export const metadata: Metadata = {
  // 공유 미리보기의 사진·주소를 절대 주소로 만들 때 쓴다(SITE_URL이 없으면 요청 주소를 따른다).
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: "브리프",
  description: "검증하고, 골라주고, 챙겨주는 정보 비서",
};

export const viewport: Viewport = { themeColor: "#1d4ed8" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NavigationProgress />
        <BusyOverlay />
        <ErrorReporter />
        {children}
        <PwaClient />
        <NativeLinkHandler />
      </body>
    </html>
  );
}
