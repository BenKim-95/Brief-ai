import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import { PwaClient } from "@/components/pwa-client";
import "./globals.css";

const plex = IBM_Plex_Sans_KR({
  variable: "--font-sans",
  weight: ["400", "500", "700"],
  display: "swap",
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
});

export const metadata: Metadata = {
  title: "브리프",
  description: "검증하고, 골라주고, 챙겨주는 정보 비서",
};

export const viewport: Viewport = { themeColor: "#1d4ed8" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaClient />
      </body>
    </html>
  );
}
