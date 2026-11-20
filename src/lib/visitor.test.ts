import { describe, expect, it } from "vitest";
import { toVisitorId } from "./visitor";

describe("toVisitorId", () => {
  it("올바른 UUID 쿠키는 v: 접두사를 붙여 돌려준다", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(toVisitorId(id)).toBe(`v:${id}`);
  });
  it("없거나 형식이 다르면 null", () => {
    expect(toVisitorId(undefined)).toBeNull();
    expect(toVisitorId("")).toBeNull();
    expect(toVisitorId("admin")).toBeNull();
    expect(toVisitorId("v:123e4567-e89b-42d3-a456-426614174000")).toBeNull();
    expect(toVisitorId("123e4567-e89b-42d3-a456-426614174000; x")).toBeNull();
  });
});
