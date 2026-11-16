import { afterEach, describe, expect, it } from "vitest";
import { requireCron } from "./cron-auth";

const req = (auth?: string) => new Request("http://x/api/cron", { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("requireCron", () => {
  it("CRON_SECRET이 없으면 503 (아무나 호출하지 못하게 닫아 둔다)", () => {
    expect(requireCron(req("Bearer anything"))?.status).toBe(503);
  });
  it("헤더가 없거나 틀리면 401", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(requireCron(req())?.status).toBe(401);
    expect(requireCron(req("Bearer wrong!"))?.status).toBe(401);
    expect(requireCron(req("s3cret"))?.status).toBe(401);
  });
  it("맞으면 통과", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(requireCron(req("Bearer s3cret"))).toBeNull();
  });
  it("관리 토큰으로는 통과하지 못한다", () => {
    process.env.CRON_SECRET = "s3cret";
    process.env.ADMIN_TOKEN = "admin";
    const r = new Request("http://x", { headers: { "x-admin-token": "admin" } });
    expect(requireCron(r)?.status).toBe(401);
    delete process.env.ADMIN_TOKEN;
  });
});
