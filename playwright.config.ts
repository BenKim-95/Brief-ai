import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// E2E는 전용 Neon 브랜치(E2E_DATABASE_URL)만 쓴다. 운영 DATABASE_URL은 읽지도 넘기지도 않는다.
if (existsSync(".env.e2e")) process.loadEnvFile(".env.e2e");

const PORT = 3200;
const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("E2E_DATABASE_URL이 없어요. .env.e2e 에 테스트용 DB 주소를 넣어 주세요.");
}

export const E2E_ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN ?? "e2e-admin-token";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // 같은 DB를 쓰므로 한 번에 하나씩 돌린다.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // 모바일 우선 앱이라 폭 380px 기준으로 확인한다.
    ...devices["Pixel 7"],
    viewport: { width: 380, height: 800 },
  },
  webServer: {
    // 개발 서버는 처음 열 때마다 라우트를 컴파일해서 느리고 불안정하다 → 빌드 후 start.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      // Next는 프로세스 환경변수를 .env.local 보다 우선한다 → 운영 DB로 새지 않는다.
      DATABASE_URL: databaseUrl,
      ADMIN_TOKEN: E2E_ADMIN_TOKEN,
      // 외부 호출(Claude, 공공데이터)은 E2E에서 쓰지 않는다.
      ANTHROPIC_API_KEY: "",
      DATA_GO_KR_SERVICE_KEY: "",
    },
  },
});
