import { describe, expect, it } from "vitest";
import { defaultNickname, displayName, profileUpdateSchema } from "./profile";

describe("displayName", () => {
  const id = "v:123e4567-e89b-42d3-a456-426614174abc";
  it("닉네임이 없으면 방문자마다 고정된 기본 이름을 쓴다", () => {
    expect(defaultNickname(id)).toBe("익명 4ABC");
    expect(displayName(id, "")).toBe("익명 4ABC");
    expect(displayName(id, null)).toBe("익명 4ABC");
  });
  it("닉네임이 있으면 그대로(앞뒤 공백 제외)", () => {
    expect(displayName(id, "  하늘 ")).toBe("하늘");
  });
});

describe("profileUpdateSchema", () => {
  it("닉네임은 12자까지, 비워도 된다", () => {
    expect(profileUpdateSchema.safeParse({ nickname: "", interestCategoryIds: [] }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ nickname: "가".repeat(12), interestCategoryIds: [] }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ nickname: "가".repeat(13), interestCategoryIds: [] }).success).toBe(false);
  });
  it("제어 문자가 든 닉네임은 거절한다", () => {
    expect(profileUpdateSchema.safeParse({ nickname: "a\nb", interestCategoryIds: [] }).success).toBe(false);
  });
  it("관심 카테고리는 양의 정수만, 20개까지", () => {
    expect(profileUpdateSchema.safeParse({ nickname: "", interestCategoryIds: [1, 2] }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ nickname: "", interestCategoryIds: [0] }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ nickname: "", interestCategoryIds: Array.from({ length: 21 }, (_, i) => i + 1) }).success).toBe(false);
  });
});
