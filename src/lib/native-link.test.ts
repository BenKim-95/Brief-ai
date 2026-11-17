import { describe, expect, it } from "vitest";
import { pathFromAppUrl } from "./native-link";

const ORIGIN = "https://brief.example.com";

describe("pathFromAppUrl", () => {
  it("같은 사이트 주소는 경로와 쿼리만 돌려준다", () => {
    expect(pathFromAppUrl("https://brief.example.com/articles/7", ORIGIN)).toBe("/articles/7");
    expect(pathFromAppUrl("https://brief.example.com/?category=2", ORIGIN)).toBe("/?category=2");
    expect(pathFromAppUrl("https://brief.example.com", ORIGIN)).toBe("/");
  });
  it("다른 사이트·다른 포트·다른 스킴은 거부", () => {
    expect(pathFromAppUrl("https://evil.example.com/articles/7", ORIGIN)).toBeNull();
    expect(pathFromAppUrl("https://brief.example.com:8443/x", ORIGIN)).toBeNull();
    expect(pathFromAppUrl("http://brief.example.com/x", ORIGIN)).toBeNull();
    expect(pathFromAppUrl("javascript:alert(1)", ORIGIN)).toBeNull();
    expect(pathFromAppUrl("app.brief.news://open", ORIGIN)).toBeNull();
  });
  it("깨진 값이나 // 로 시작하는 경로는 거부", () => {
    expect(pathFromAppUrl("not a url", ORIGIN)).toBeNull();
    expect(pathFromAppUrl("", ORIGIN)).toBeNull();
    expect(pathFromAppUrl("https://brief.example.com//evil.com/x", ORIGIN)).toBeNull();
  });
});
