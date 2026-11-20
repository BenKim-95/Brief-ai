import { describe, expect, it } from "vitest";
import { clientReportSchema, errorCode, normalizeMessage, normalizePath } from "./code";

describe("normalizeMessage", () => {
  it("숫자·주소·긴 식별자를 자리표시자로 바꿔 같은 원인끼리 묶는다", () => {
    expect(normalizeMessage("Failed to fetch https://x.com/a?id=1")).toBe("Failed to fetch <url>");
    expect(normalizeMessage("article 123 not found")).toBe("article # not found");
    expect(normalizeMessage("bad token deadbeef1234")).toBe("bad token <id>");
    expect(normalizeMessage("  a   b \n c ")).toBe("a b c");
  });
});

describe("normalizePath", () => {
  it("쿼리·해시·도메인을 떼고 숫자 구간은 :id로", () => {
    expect(normalizePath("/articles/7?x=1#top")).toBe("/articles/:id");
    expect(normalizePath("https://brief.example/community/42")).toBe("/community/:id");
    expect(normalizePath("/housing/saved")).toBe("/housing/saved");
    expect(normalizePath(undefined)).toBe("");
  });
});

describe("errorCode", () => {
  it("형식은 E-<출처>-<5자리>", () => {
    expect(errorCode("web", "boom", "/")).toMatch(/^E-WEB-[0-9A-Z]{5}$/);
    expect(errorCode("app", "boom", "/")).toMatch(/^E-APP-[0-9A-Z]{5}$/);
    expect(errorCode("server", "boom", "/")).toMatch(/^E-SRV-[0-9A-Z]{5}$/);
  });
  it("같은 원인은 같은 코드(숫자·경로 id만 달라도)", () => {
    expect(errorCode("web", "article 1 failed", "/articles/1")).toBe(errorCode("web", "article 2 failed", "/articles/2"));
  });
  it("원인·출처·화면이 다르면 다른 코드", () => {
    const a = errorCode("web", "boom", "/");
    expect(errorCode("web", "bang", "/")).not.toBe(a);
    expect(errorCode("app", "boom", "/")).not.toBe(a);
    expect(errorCode("web", "boom", "/saved")).not.toBe(a);
  });
});

describe("clientReportSchema", () => {
  it("웹·앱만 보낼 수 있고(서버 오류는 서버가 직접 기록), 메시지가 비면 거절", () => {
    expect(clientReportSchema.safeParse({ source: "web", message: "x" }).success).toBe(true);
    expect(clientReportSchema.safeParse({ source: "server", message: "x" }).success).toBe(false);
    expect(clientReportSchema.safeParse({ source: "web", message: "  " }).success).toBe(false);
  });
});
