import { describe, expect, it } from "vitest";
import { kstDay, pickFiveMinute, type Candidate } from "./five-minute";

const c = (id: number, categoryId: number | null, views: number, at = id): Candidate => ({ id, categoryId, views, at });

describe("pickFiveMinute", () => {
  it("분야마다 가장 많이 본 기사 1개만 고르고, 조회수가 높은 분야부터 나열한다", () => {
    const out = pickFiveMinute([
      c(1, 1, 5), c(2, 1, 9), // 분야1 → 2번
      c(3, 2, 7), c(4, 2, 1), // 분야2 → 3번
      c(5, 3, 20), // 분야3 → 5번
    ], 3);
    expect(out.map((x) => x.id)).toEqual([5, 2, 3]);
  });

  it("조회수가 같으면 더 최근 기사를 먼저 고른다", () => {
    const out = pickFiveMinute([c(1, 1, 0, 100), c(2, 1, 0, 300), c(3, 1, 0, 200)], 1);
    expect(out.map((x) => x.id)).toEqual([2]);
  });

  it("분야가 6개 이상이어도 5개만 돌려준다", () => {
    const list = Array.from({ length: 8 }, (_, i) => c(i + 1, i + 1, i));
    const out = pickFiveMinute(list);
    expect(out).toHaveLength(5);
    expect(out.map((x) => x.id)).toEqual([8, 7, 6, 5, 4]);
  });

  it("분야가 5개보다 적으면 남은 기사 중 많이 본 순으로 채운다(분류 없는 기사 포함)", () => {
    const out = pickFiveMinute([
      c(1, 1, 3), c(2, 1, 8), c(3, 2, 4), c(4, null, 6), c(5, null, 1), c(6, 1, 2),
    ]);
    // 분야 1(→2번, 8), 분야 2(→3번, 4) 먼저, 그다음 남은 것 중 4번(6), 1번(3), 6번(2)
    expect(out.map((x) => x.id)).toEqual([2, 3, 4, 1, 6]);
  });

  it("분류 없는 기사는 분야 자리에서는 빠지고, 채울 때만 쓰인다", () => {
    const out = pickFiveMinute([c(1, null, 50), c(2, 1, 1)]);
    expect(out.map((x) => x.id)).toEqual([2, 1]);
  });

  it("후보가 없으면 빈 목록", () => {
    expect(pickFiveMinute([])).toEqual([]);
  });
});

describe("kstDay", () => {
  it("한국 시간 날짜로 바꾼다(UTC 15시가 넘으면 다음 날)", () => {
    expect(kstDay(new Date("2026-11-19T14:59:00Z"))).toBe("2026-11-19");
    expect(kstDay(new Date("2026-11-19T15:00:00Z"))).toBe("2026-11-20");
  });
});
