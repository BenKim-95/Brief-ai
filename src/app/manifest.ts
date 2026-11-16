import type { MetadataRoute } from "next";

// 홈 화면에 설치할 수 있게 하는 웹 앱 정보. 아이콘은 코드로 그린다(src/lib/pwa-icon.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "브리프",
    short_name: "브리프",
    description: "검증하고, 골라주고, 챙겨주는 정보 비서",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "ko",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
