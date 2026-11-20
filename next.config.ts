import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E는 따로 빌드한다(NEXT_DIST_DIR=.next-e2e). 개발 서버가 같은 .next 폴더를 쓰고 있어도 서로 부딪히지 않는다.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // 서비스 워커는 항상 최신 파일을 받아야 업데이트가 반영된다.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
