import { describe, expect, it } from "vitest";
import { COMMENT_MAX, POST_BODY_MAX, TITLE_MAX, commentCreateSchema, postCreateSchema, reportSchema } from "./rules";

describe("postCreateSchema", () => {
  it("제목의 겹친 공백·줄바꿈은 한 칸으로, 내용의 앞뒤 공백은 지운다", () => {
    const r = postCreateSchema.parse({ title: "  안녕\n  하세요  ", body: "\n\n본문이에요\n\n\n\n둘째 줄\n" });
    expect(r.title).toBe("안녕 하세요");
    expect(r.body).toBe("본문이에요\n\n둘째 줄");
  });
  it("빈 제목·내용은 이유와 함께 거절한다", () => {
    const t = postCreateSchema.safeParse({ title: "   ", body: "내용" });
    expect(t.success).toBe(false);
    if (!t.success) expect(t.error.issues[0].message).toBe("제목을 써 주세요.");
    expect(postCreateSchema.safeParse({ title: "제목", body: " \n " }).success).toBe(false);
  });
  it("길이 제한", () => {
    expect(postCreateSchema.safeParse({ title: "가".repeat(TITLE_MAX), body: "나" }).success).toBe(true);
    expect(postCreateSchema.safeParse({ title: "가".repeat(TITLE_MAX + 1), body: "나" }).success).toBe(false);
    expect(postCreateSchema.safeParse({ title: "가", body: "나".repeat(POST_BODY_MAX + 1) }).success).toBe(false);
  });
  it("보이지 않는 제어 문자는 막고, 줄바꿈은 허용한다", () => {
    expect(postCreateSchema.safeParse({ title: "가", body: "a\u0000b" }).success).toBe(false);
    expect(postCreateSchema.safeParse({ title: "가", body: "a\nb" }).success).toBe(true);
  });
  it("articleId는 양의 정수만", () => {
    expect(postCreateSchema.safeParse({ title: "가", body: "나", articleId: 3 }).success).toBe(true);
    expect(postCreateSchema.safeParse({ title: "가", body: "나", articleId: -1 }).success).toBe(false);
    expect(postCreateSchema.safeParse({ title: "가", body: "나", articleId: "3" }).success).toBe(false);
  });
});

describe("commentCreateSchema / reportSchema", () => {
  it("댓글은 1~500자", () => {
    expect(commentCreateSchema.safeParse({ body: "좋아요" }).success).toBe(true);
    expect(commentCreateSchema.safeParse({ body: "" }).success).toBe(false);
    expect(commentCreateSchema.safeParse({ body: "가".repeat(COMMENT_MAX + 1) }).success).toBe(false);
  });
  it("신고 대상은 글 또는 댓글", () => {
    expect(reportSchema.safeParse({ kind: "post", id: 1 }).success).toBe(true);
    expect(reportSchema.safeParse({ kind: "user", id: 1 }).success).toBe(false);
  });
});
