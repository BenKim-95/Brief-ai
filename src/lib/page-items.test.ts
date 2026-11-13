import { describe, expect, it } from "vitest";
import { pageItems } from "./page-items";

describe("pageItems", () => {
  it("가운데 페이지: 양쪽에 … 표시", () => {
    expect(pageItems(50, 100)).toEqual([1, "gap", 48, 49, 50, 51, 52, "gap", 100]);
  });
  it("첫 페이지와 이어지면 앞쪽 … 생략", () => {
    expect(pageItems(4, 100)).toEqual([1, 2, 3, 4, 5, 6, "gap", 100]);
    expect(pageItems(1, 100)).toEqual([1, 2, 3, "gap", 100]);
  });
  it("마지막 페이지와 이어지면 뒤쪽 … 생략", () => {
    expect(pageItems(97, 100)).toEqual([1, "gap", 95, 96, 97, 98, 99, 100]);
    expect(pageItems(100, 100)).toEqual([1, "gap", 98, 99, 100]);
  });
  it("페이지가 적으면 전부 표시", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(1, 6)).toEqual([1, 2, 3, "gap", 6]);
  });
  it("범위를 벗어난 현재 페이지는 보정", () => {
    expect(pageItems(999, 10)).toEqual([1, "gap", 8, 9, 10]);
  });
});
