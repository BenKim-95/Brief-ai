import { describe, expect, it } from "vitest";
import { hasSimilarTitle, isSimilarTitle, normalizeUrl } from "./dedupe";

describe("normalizeUrl", () => {
  it("추적 파라미터·해시·www·끝 슬래시를 무시", () => {
    const base = normalizeUrl("https://news.example.com/a/1");
    expect(normalizeUrl("https://www.news.example.com/a/1/?utm_source=x&fbclid=y#top")).toBe(base);
    expect(normalizeUrl("http://news.example.com/a/1")).toBe(base);
  });
  it("의미 있는 쿼리는 유지", () => {
    expect(normalizeUrl("https://x.com/v?id=1")).not.toBe(normalizeUrl("https://x.com/v?id=2"));
    expect(normalizeUrl("https://x.com/v?b=2&a=1")).toBe(normalizeUrl("https://x.com/v?a=1&b=2"));
  });
});

describe("isSimilarTitle", () => {
  it("말머리·언론사 꼬리만 다른 제목은 중복", () => {
    expect(
      isSimilarTitle(
        "[속보] 정부, 수도권 주택 공급 확대 방안 발표 - 매일경제",
        "정부 수도권 주택 공급 확대 방안 발표",
      ),
    ).toBe(true);
  });
  it("조금 다르게 쓴 같은 기사 제목은 중복", () => {
    expect(
      isSimilarTitle("한국은행 기준금리 연 2.50% 동결 결정", "한국은행, 기준금리 2.50% 동결 결정"),
    ).toBe(true);
  });
  it("다른 기사는 중복 아님", () => {
    expect(isSimilarTitle("서울 아파트값 5주 연속 상승", "전국 전세 거래량 소폭 감소")).toBe(false);
  });
  it("짧은 제목은 정확히 같을 때만 중복", () => {
    expect(isSimilarTitle("금리 동결", "금리 인하")).toBe(false);
    expect(isSimilarTitle("금리 동결", "금리 동결")).toBe(true);
  });
  it("hasSimilarTitle", () => {
    expect(hasSimilarTitle("정부 주택 공급 확대 방안 발표", ["다른 기사 제목입니다 정말로", "[단독] 정부 주택 공급 확대 방안 발표"])).toBe(true);
    expect(hasSimilarTitle("정부 주택 공급 확대 방안 발표", [])).toBe(false);
  });
});
