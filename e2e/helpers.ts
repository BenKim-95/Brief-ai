import type { Page } from "@playwright/test";

export const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN ?? "e2e-admin-token";

/** 앱이 관리 토큰을 읽는 곳(localStorage "admin-token")에 미리 넣어 둔다. */
export async function signInAsAdmin(page: Page, token = ADMIN_TOKEN) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("admin-token", t);
    } catch {}
  }, token);
}
