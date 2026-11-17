import { describe, expect, it } from "vitest";
import { byHotness, computeHotness, isRelatedTitle, selectHotTopics, type Selectable } from "./select";

const item = (id: number, categoryId: number | null, sources: number, mentions = sources, time = 0): Selectable => ({
  id,
  categoryId,
  sources,
  mentions,
  time,
});

describe("isRelatedTitle", () => {
  it("매체마다 다르게 쓴 같은 사건 제목은 관련 기사로 본다", () => {
    expect(isRelatedTitle("한국은행 기준금리 연 2.50% 동결 결정", "기준금리 2.50% 동결한 한국은행 총재 발언")).toBe(true);
  });
  it("다른 이야기는 아니다", () => {
    expect(isRelatedTitle("한국은행 기준금리 동결 결정", "서울 아파트 청약 일정이 발표됐어요")).toBe(false);
  });
  it("너무 짧은 제목은 정확히 같을 때만", () => {
    expect(isRelatedTitle("금리 동결", "금리 인상")).toBe(false);
    expect(isRelatedTitle("금리 동결", "금리 동결")).toBe(true);
  });
});

describe("computeHotness", () => {
  const pool = [
    { title: "정부가 수도권 주택 공급 확대 방안을 발표했어요", sourceId: 1 },
    { title: "수도권 주택 공급 확대 방안 발표, 정부 설명", sourceId: 2 },
    { title: "정부 수도권 주택 공급 확대 방안 발표 소식", sourceId: 2 }, // 같은 매체의 또 다른 기사
    { title: "한국은행이 기준금리를 동결했어요", sourceId: 3 },
  ];
  it("같은 이야기를 다룬 기사 수와 매체 수를 센다(자기 자신 포함)", () => {
    expect(computeHotness(pool[0], pool)).toEqual({ sources: 2, mentions: 3 });
  });
  it("아무도 안 다룬 이야기는 1건 1매체", () => {
    expect(computeHotness(pool[3], pool)).toEqual({ sources: 1, mentions: 1 });
  });
});

describe("byHotness", () => {
  it("매체 수 → 기사 수 → 최신 순", () => {
    const list = [item(1, 1, 1, 1, 100), item(2, 1, 3, 3, 1), item(3, 1, 3, 5, 1), item(4, 1, 1, 1, 200)];
    expect([...list].sort(byHotness).map((i) => i.id)).toEqual([3, 2, 4, 1]);
  });
});

describe("selectHotTopics", () => {
  it("카테고리마다 돌아가며 가장 핫한 것부터 고른다", () => {
    const items = [
      item(1, 10, 1), item(2, 10, 4), item(3, 10, 2), // 10번: 핫 순서 2,3,1
      item(4, 20, 3), item(5, 20, 1), // 20번: 4,5
    ];
    expect(selectHotTopics(items, 4, [10, 20])).toEqual([2, 4, 3, 5]);
    expect(selectHotTopics(items, 3, [10, 20])).toEqual([2, 4, 3]);
    expect(selectHotTopics(items, 1, [10, 20])).toEqual([2]);
  });

  it("카테고리 순서를 따르고, 한 분야에 몰려 있어도 한 분야만 채우지 않는다", () => {
    const items = [item(1, 20, 5), item(2, 10, 1), item(3, 10, 1), item(4, 10, 1)];
    expect(selectHotTopics(items, 2, [10, 20])).toEqual([2, 1]);
  });

  it("후보가 모자란 분야는 건너뛰고 남는 자리는 다른 분야가 채운다", () => {
    const items = [item(1, 10, 1), item(2, 20, 1), item(3, 20, 1), item(4, 20, 1)];
    expect(selectHotTopics(items, 4, [10, 20])).toEqual([1, 2, 3, 4]);
  });

  it("분류가 없는 기사는 마지막 분야로 취급한다", () => {
    const items = [item(1, null, 9), item(2, 10, 1), item(3, 10, 1)];
    expect(selectHotTopics(items, 3, [10])).toEqual([2, 1, 3]);
  });

  it("후보가 한도보다 적으면 전부, 한도가 0이면 아무것도 고르지 않는다", () => {
    const items = [item(1, 10, 1), item(2, 20, 1)];
    expect(selectHotTopics(items, 40, [10, 20]).sort()).toEqual([1, 2]);
    expect(selectHotTopics(items, 0, [10, 20])).toEqual([]);
    expect(selectHotTopics([], 5, [10])).toEqual([]);
  });

  it("카테고리 순서에 없는 분야도 빠뜨리지 않는다", () => {
    const items = [item(1, 99, 1), item(2, 10, 1)];
    expect(selectHotTopics(items, 2, [10])).toEqual([2, 1]);
  });

  it("같은 핫함이면 최신 기사를 먼저", () => {
    const items = [item(1, 10, 1, 1, 100), item(2, 10, 1, 1, 300), item(3, 10, 1, 1, 200)];
    expect(selectHotTopics(items, 3, [10])).toEqual([2, 3, 1]);
  });
});
