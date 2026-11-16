import { describe, expect, it } from "vitest";
import { buildDigestPayload, digestSince, parseRule } from "./digest";
import { pushPayloadSchema } from "./payload";

const NOW = new Date("2026-11-17T22:00:00.000Z");
const H = 3_600_000;

describe("parseRule", () => {
  it("비었거나 깨진 규칙은 기본값(전체 뉴스 + 청약, 발송 이력 없음)", () => {
    for (const raw of [undefined, null, {}, "x", { kind: "other" }, { categoryIds: ["a"] }]) {
      expect(parseRule(raw)).toEqual({
        kind: "daily_digest",
        categoryIds: null,
        includeHousing: true,
        lastDigestAt: null,
      });
    }
  });
  it("저장된 값을 읽는다", () => {
    const r = parseRule({ categoryIds: [1, 2], includeHousing: false, lastDigestAt: "2026-11-16T22:00:00.000Z" });
    expect(r.categoryIds).toEqual([1, 2]);
    expect(r.includeHousing).toBe(false);
  });
});

describe("digestSince", () => {
  const base = parseRule({});
  it("이력이 없으면 24시간 전", () => {
    expect(digestSince(base, NOW).getTime()).toBe(NOW.getTime() - 24 * H);
  });
  it("마지막 발송 시각 이후만 센다", () => {
    const last = new Date(NOW.getTime() - 5 * H).toISOString();
    expect(digestSince({ ...base, lastDigestAt: last }, NOW).toISOString()).toBe(last);
  });
  it("오래 쉬었으면 48시간까지만 거슬러 올라간다", () => {
    const old = new Date(NOW.getTime() - 10 * 24 * H).toISOString();
    expect(digestSince({ ...base, lastDigestAt: old }, NOW).getTime()).toBe(NOW.getTime() - 48 * H);
  });
});

describe("buildDigestPayload", () => {
  it("새 소식이 없으면 보내지 않는다", () => {
    expect(buildDigestPayload({ news: 0, housing: 0, topTitle: "x" })).toBeNull();
  });
  it("개수와 대표 제목을 담고 payload 규칙을 지킨다", () => {
    const p = buildDigestPayload({ news: 12, housing: 3, topTitle: "전세 대출 규정이 바뀌어요" });
    expect(p).toEqual({
      title: "오늘의 새 소식",
      body: "뉴스 12개, 청약 공고 3개가 새로 올라왔어요. 전세 대출 규정이 바뀌어요",
      url: "/",
    });
    expect(pushPayloadSchema.safeParse(p).success).toBe(true);
  });
  it("한 종류만 있어도 된다", () => {
    expect(buildDigestPayload({ news: 0, housing: 2, topTitle: null })?.body).toBe("청약 공고 2개가 새로 올라왔어요.");
  });
  it("긴 제목은 200자 안으로 줄인다", () => {
    const p = buildDigestPayload({ news: 1, housing: 0, topTitle: "가".repeat(500) });
    expect(p!.body.length).toBeLessThanOrEqual(200);
    expect(pushPayloadSchema.safeParse(p).success).toBe(true);
  });
  it("추천·전망 같은 판단 표현이 없다", () => {
    const p = buildDigestPayload({ news: 3, housing: 1, topTitle: "제목" });
    expect(`${p!.title} ${p!.body}`).not.toMatch(/추천|유망|시세 차익|오를|급등/);
  });
});
