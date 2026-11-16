import { expect, test } from "@playwright/test";

const CRON_SECRET = process.env.E2E_CRON_SECRET ?? "e2e-cron-secret";
const paths = ["/api/cron/news", "/api/cron/housing"];

test.describe("Cron 엔드포인트", () => {
  for (const path of paths) {
    test(`${path}: 인증이 없거나 틀리면 401, 관리 토큰으로도 열리지 않는다`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(401);
      expect((await request.get(path, { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
      const admin = process.env.E2E_ADMIN_TOKEN ?? "e2e-admin-token";
      expect((await request.get(path, { headers: { "x-admin-token": admin } })).status()).toBe(401);
    });

    test(`${path}: 인증이 맞으면 통과하고, 외부 키가 없으면 503으로 이유를 알려준다`, async ({ request }) => {
      const res = await request.get(path, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
      expect(res.status()).toBe(503);
      expect((await res.json()).error).toMatch(/ANTHROPIC_API_KEY|DATA_GO_KR_SERVICE_KEY/);
    });
  }
});
