import { afterEach, describe, expect, it } from "vitest";
import { requireAdmin } from "./admin-auth";

const req = (token?: string) =>
  new Request("http://x/api", {
    headers: token ? { "x-admin-token": token } : {},
  });

afterEach(() => {
  delete process.env.ADMIN_TOKEN;
});

describe("requireAdmin", () => {
  it("returns 503 when ADMIN_TOKEN is not configured", () => {
    expect(requireAdmin(req("anything"))?.status).toBe(503);
  });

  it("returns 401 for a missing or wrong token", () => {
    process.env.ADMIN_TOKEN = "secret";
    expect(requireAdmin(req())?.status).toBe(401);
    expect(requireAdmin(req("wrong!"))?.status).toBe(401);
  });

  it("passes with the right token", () => {
    process.env.ADMIN_TOKEN = "secret";
    expect(requireAdmin(req("secret"))).toBeNull();
  });
});
