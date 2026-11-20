import { describe, expect, it } from "vitest";
import { mergeInterests } from "./for-me";

describe("mergeInterests", () => {
  it("직접 고른 것을 먼저, 저장에서 읽은 것을 뒤에 붙인다", () => {
    expect(mergeInterests([3, 1], [2, 5])).toEqual({ chosen: [3, 1], fromSaved: [2, 5], all: [3, 1, 2, 5] });
  });
  it("겹치는 카테고리는 한 번만 센다", () => {
    expect(mergeInterests([1, 1, 2], [2, 3, 3])).toEqual({ chosen: [1, 2], fromSaved: [3], all: [1, 2, 3] });
  });
  it("아무것도 없으면 비어 있다", () => {
    expect(mergeInterests([], [])).toEqual({ chosen: [], fromSaved: [], all: [] });
  });
});
