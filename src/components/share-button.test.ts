import { describe, expect, it } from "vitest";
import { clip, toShareUrl } from "./share-button";

describe("toShareUrl", () => {
  it("사이트 안 경로만 전체 주소로 바꾼다", () => {
    expect(toShareUrl("/articles/3", "https://brief.example")).toBe("https://brief.example/articles/3");
  });
  it("다른 사이트로 가는 값은 거절한다", () => {
    expect(toShareUrl("//evil.example/x", "https://brief.example")).toBeNull();
    expect(toShareUrl("https://evil.example", "https://brief.example")).toBeNull();
    expect(toShareUrl("articles/3", "https://brief.example")).toBeNull();
  });
});

describe("clip", () => {
  it("짧으면 그대로, 길면 …로 자른다", () => {
    expect(clip("가나다")).toBe("가나다");
    const long = "가".repeat(150);
    const out = clip(long, 100);
    expect(out.length).toBe(100);
    expect(out.endsWith("…")).toBe(true);
  });
  it("줄바꿈과 겹친 공백을 한 칸으로 줄인다", () => {
    expect(clip("가\n\n나   다")).toBe("가 나 다");
  });
});
