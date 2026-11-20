import { z } from "zod";

/** 커뮤니티 글·댓글 제한값. 클라이언트와 서버가 함께 쓰므로 DB 코드를 끌어오지 않는다. */
export const TITLE_MAX = 80;
export const POST_BODY_MAX = 2000;
export const COMMENT_MAX = 500;
export const POSTS_PER_PAGE = 10;

/** 한 방문자가 1시간에 쓸 수 있는 글·댓글 수(도배 방지). */
export const POSTS_PER_HOUR = 5;
export const COMMENTS_PER_HOUR = 20;
/** 서로 다른 방문자 몇 명이 신고하면 자동으로 가려지는지. 가려진 글은 관리자가 되살리거나 지운다. */
export const REPORT_HIDE_THRESHOLD = 3;

/** 줄바꿈·탭은 허용하고 그 밖의 제어 문자(보이지 않는 문자)는 막는다. */
const noControl = (s: string) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s);

/** 앞뒤 공백을 다듬고, 3줄 이상 이어진 빈 줄은 2줄로 줄인다. */
function tidy(s: string) {
  return s.replace(/\r\n/g, "\n").trim().replace(/\n{3,}/g, "\n\n");
}

export const postCreateSchema = z.object({
  title: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "제목을 써 주세요.").max(TITLE_MAX, `제목은 ${TITLE_MAX}자까지 쓸 수 있어요.`))
    .refine(noControl, "제목에 쓸 수 없는 문자가 있어요."),
  body: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(1, "내용을 써 주세요.").max(POST_BODY_MAX, `내용은 ${POST_BODY_MAX}자까지 쓸 수 있어요.`))
    .refine(noControl, "내용에 쓸 수 없는 문자가 있어요."),
  /** 특정 뉴스 기사에 대한 이야기라면 그 기사 번호 */
  articleId: z.number().int().positive().optional(),
});

export const commentCreateSchema = z.object({
  body: z
    .string()
    .transform(tidy)
    .pipe(z.string().min(1, "댓글을 써 주세요.").max(COMMENT_MAX, `댓글은 ${COMMENT_MAX}자까지 쓸 수 있어요.`))
    .refine(noControl, "댓글에 쓸 수 없는 문자가 있어요."),
});

export const reportSchema = z.object({
  kind: z.enum(["post", "comment"]),
  id: z.number().int().positive(),
});

export const adminActionSchema = z.object({
  kind: z.enum(["post", "comment"]),
  id: z.number().int().positive(),
  action: z.enum(["restore", "delete"]),
});
