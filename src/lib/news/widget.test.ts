import { describe, expect, it } from "vitest";
import type { ArticleCard } from "./queries";
import { shorten, toWidgetItem, widgetQuerySchema } from "./widget";

const card = (over: Partial<ArticleCard> = {}): ArticleCard => ({
  id: 7,
  url: "https://news.example.com/a",
  titleKo: "제목",
  summaryKo: "요약",
  imageUrl: null,
  categoryId: 1,
  categoryName: "부동산",
  sourceName: "출처",
  publishedAt: new Date("2026-11-17T01:00:00Z"),
  fetchedAt: new Date("2026-11-17T02:00:00Z"),
  ...over,
});

describe("shorten", () => {
  it("짧으면 그대로, 줄바꿈과 공백은 한 칸으로", () => {
    expect(shorten("가나다")).toBe("가나다");
    expect(shorten("가\n\n  나\t다")).toBe("가 나 다");
  });
  it("길면 글자 수 기준으로 자르고 …을 붙인다(한글·이모지가 깨지지 않게)", () => {
    const out = shorten("가".repeat(100), 10);
    expect(Array.from(out)).toHaveLength(10);
    expect(out.endsWith("…")).toBe(true);
    const emoji = shorten("😀".repeat(30), 5);
    expect(Array.from(emoji)).toHaveLength(5);
    expect(emoji).toBe("😀😀😀😀…");
  });
});

describe("toWidgetItem", () => {
  it("원문 주소가 아니라 앱 안 경로를 담고, 이미지 주소는 담지 않는다", () => {
    const item = toWidgetItem(card());
    expect(item).toEqual({
      id: 7,
      title: "제목",
      summary: "요약",
      category: "부동산",
      source: "출처",
      publishedAt: "2026-11-17T01:00:00.000Z",
      path: "/articles/7",
    });
    expect(JSON.stringify(item)).not.toContain("news.example.com");
  });
  it("발행 시각이 없으면 수집 시각을 쓴다", () => {
    expect(toWidgetItem(card({ publishedAt: null })).publishedAt).toBe("2026-11-17T02:00:00.000Z");
  });
});

describe("widgetQuerySchema", () => {
  it("기본 3개, 1~5만 허용", () => {
    expect(widgetQuerySchema.parse({}).limit).toBe(3);
    expect(widgetQuerySchema.parse({ limit: "5" }).limit).toBe(5);
    expect(widgetQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(widgetQuerySchema.safeParse({ limit: "6" }).success).toBe(false);
    expect(widgetQuerySchema.safeParse({ limit: "abc" }).success).toBe(false);
    expect(widgetQuerySchema.safeParse({ limit: "2.5" }).success).toBe(false);
  });
});
