import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 앱은 배포된 사이트(Vercel 주소)를 그대로 불러온다(PRD: Capacitor가 Vercel URL 로드).
 * 주소는 코드에 박지 않고 `CAP_SERVER_URL`(예: https://brief.example.com)로 넣고 `npx cap sync android` 한다.
 * 같은 값이 앱 안의 capacitor.config.json 으로 복사되고, 안드로이드 위젯도 그 파일에서 주소를 읽는다.
 * 주소가 없으면 안내 화면(capacitor-www)만 보인다.
 */
const serverUrl = process.env.CAP_SERVER_URL?.trim().replace(/\/+$/, "");

const config: CapacitorConfig = {
  appId: "app.brief.news",
  appName: "브리프",
  webDir: "capacitor-www",
  ...(serverUrl
    ? { server: { url: serverUrl, cleartext: serverUrl.startsWith("http://") } }
    : {}),
};

export default config;
