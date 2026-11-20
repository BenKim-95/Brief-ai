import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { getDb } from "@/db";
import { articles, communityComments, communityPosts, communityReports } from "@/db/schema";
import { displayName, getProfile } from "@/lib/my/profile";
import {
  COMMENTS_PER_HOUR,
  POSTS_PER_HOUR,
  POSTS_PER_PAGE,
  REPORT_HIDE_THRESHOLD,
} from "./rules";

type Db = ReturnType<typeof getDb>;

export type PostRow = {
  id: number;
  authorName: string;
  title: string;
  body: string;
  createdAt: Date;
  commentCount: number;
  articleId: number | null;
  articleTitle: string | null;
  /** 이 글을 쓴 사람이 지금 보고 있는 방문자인지(삭제 버튼용). 방문자 번호 자체는 내보내지 않는다. */
  mine: boolean;
};

export type CommentRow = { id: number; authorName: string; body: string; createdAt: Date; mine: boolean };

const commentCountSql = sql<number>`(select count(*)::int from ${communityComments} c where c.post_id = ${communityPosts.id} and c.hidden = false)`;

const postColumns = (visitorId: string | null) => ({
  id: communityPosts.id,
  authorName: communityPosts.authorName,
  title: communityPosts.title,
  body: communityPosts.body,
  createdAt: communityPosts.createdAt,
  commentCount: commentCountSql,
  articleId: communityPosts.articleId,
  articleTitle: articles.titleKo,
  mine: visitorId ? sql<boolean>`${communityPosts.visitorId} = ${visitorId}` : sql<boolean>`false`,
});

export async function countPosts(db: Db): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(communityPosts)
    .where(eq(communityPosts.hidden, false));
  return r?.n ?? 0;
}

export async function listPosts(db: Db, page: number, visitorId: string | null): Promise<PostRow[]> {
  return db
    .select(postColumns(visitorId))
    .from(communityPosts)
    .leftJoin(articles, eq(communityPosts.articleId, articles.id))
    .where(eq(communityPosts.hidden, false))
    .orderBy(desc(communityPosts.createdAt), desc(communityPosts.id))
    .limit(POSTS_PER_PAGE)
    .offset((page - 1) * POSTS_PER_PAGE);
}

/** 가려진 글은 null(관리자는 includeHidden으로 볼 수 있다). */
export async function getPost(db: Db, id: number, visitorId: string | null, includeHidden = false): Promise<PostRow | null> {
  const [row] = await db
    .select(postColumns(visitorId))
    .from(communityPosts)
    .leftJoin(articles, eq(communityPosts.articleId, articles.id))
    .where(and(eq(communityPosts.id, id), includeHidden ? undefined : eq(communityPosts.hidden, false)))
    .limit(1);
  return row ?? null;
}

export async function listComments(db: Db, postId: number, visitorId: string | null): Promise<CommentRow[]> {
  return db
    .select({
      id: communityComments.id,
      authorName: communityComments.authorName,
      body: communityComments.body,
      createdAt: communityComments.createdAt,
      mine: visitorId ? sql<boolean>`${communityComments.visitorId} = ${visitorId}` : sql<boolean>`false`,
    })
    .from(communityComments)
    .where(and(eq(communityComments.postId, postId), eq(communityComments.hidden, false)))
    .orderBy(asc(communityComments.createdAt), asc(communityComments.id))
    .limit(300);
}

export type CreateResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

async function authorOf(db: Db, visitorId: string) {
  return displayName(visitorId, (await getProfile(db, visitorId)).nickname);
}

const hourAgo = () => new Date(new Date().getTime() - 3_600_000);

export async function createPost(
  db: Db,
  visitorId: string,
  input: { title: string; body: string; articleId?: number },
): Promise<CreateResult<{ id: number }>> {
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(communityPosts)
    .where(and(eq(communityPosts.visitorId, visitorId), gte(communityPosts.createdAt, hourAgo())));
  if ((recent?.n ?? 0) >= POSTS_PER_HOUR) {
    return { ok: false, status: 429, error: `글은 1시간에 ${POSTS_PER_HOUR}개까지 쓸 수 있어요. 잠시 뒤에 다시 써 주세요.` };
  }
  let articleId: number | null = null;
  if (input.articleId) {
    const [a] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, input.articleId));
    articleId = a?.id ?? null; // 없는 기사 번호는 조용히 연결만 뺀다
  }
  const [row] = await db
    .insert(communityPosts)
    .values({ visitorId, authorName: await authorOf(db, visitorId), title: input.title, body: input.body, articleId })
    .returning({ id: communityPosts.id });
  return { ok: true, value: { id: row.id } };
}

export async function createComment(
  db: Db,
  visitorId: string,
  postId: number,
  body: string,
): Promise<CreateResult<{ id: number }>> {
  const [post] = await db
    .select({ id: communityPosts.id })
    .from(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.hidden, false)));
  if (!post) return { ok: false, status: 404, error: "찾을 수 없는 글이에요." };
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(communityComments)
    .where(and(eq(communityComments.visitorId, visitorId), gte(communityComments.createdAt, hourAgo())));
  if ((recent?.n ?? 0) >= COMMENTS_PER_HOUR) {
    return { ok: false, status: 429, error: `댓글은 1시간에 ${COMMENTS_PER_HOUR}개까지 쓸 수 있어요. 잠시 뒤에 다시 써 주세요.` };
  }
  const [row] = await db
    .insert(communityComments)
    .values({ postId, visitorId, authorName: await authorOf(db, visitorId), body })
    .returning({ id: communityComments.id });
  return { ok: true, value: { id: row.id } };
}

/** 쓴 사람(또는 관리자)만 지울 수 있다. 지웠으면 true. */
export async function deletePost(db: Db, id: number, who: { visitorId: string | null; admin: boolean }): Promise<boolean> {
  const mineOnly = who.admin ? undefined : who.visitorId ? eq(communityPosts.visitorId, who.visitorId) : sql`false`;
  const gone = await db
    .delete(communityPosts)
    .where(and(eq(communityPosts.id, id), mineOnly))
    .returning({ id: communityPosts.id });
  return gone.length > 0;
}

export async function deleteComment(db: Db, id: number, who: { visitorId: string | null; admin: boolean }): Promise<boolean> {
  const mineOnly = who.admin ? undefined : who.visitorId ? eq(communityComments.visitorId, who.visitorId) : sql`false`;
  const gone = await db
    .delete(communityComments)
    .where(and(eq(communityComments.id, id), mineOnly))
    .returning({ id: communityComments.id });
  return gone.length > 0;
}

/**
 * 신고를 기록한다. 서로 다른 방문자 REPORT_HIDE_THRESHOLD명이 신고하면 가린다.
 * 자기 글은 신고할 수 없고(`own`), 없는 대상은 `missing`.
 */
export async function reportContent(
  db: Db,
  kind: "post" | "comment",
  id: number,
  visitorId: string,
): Promise<"reported" | "own" | "missing"> {
  const table = kind === "post" ? communityPosts : communityComments;
  const [target] = await db
    .select({ id: table.id, owner: table.visitorId })
    .from(table)
    .where(and(eq(table.id, id), eq(table.hidden, false)));
  if (!target) return "missing";
  if (target.owner === visitorId) return "own";
  await db.insert(communityReports).values({ kind, targetId: id, visitorId }).onConflictDoNothing();
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(communityReports)
    .where(and(eq(communityReports.kind, kind), eq(communityReports.targetId, id)));
  if ((r?.n ?? 0) >= REPORT_HIDE_THRESHOLD) {
    await db.update(table).set({ hidden: true }).where(eq(table.id, id));
  }
  return "reported";
}

export type HiddenItem = {
  kind: "post" | "comment";
  id: number;
  authorName: string;
  text: string;
  reports: number;
  createdAt: Date;
};

/** 관리자용: 신고로 가려진 글·댓글 목록. */
export async function listHidden(db: Db): Promise<HiddenItem[]> {
  const posts = await db
    .select({
      id: communityPosts.id,
      authorName: communityPosts.authorName,
      title: communityPosts.title,
      body: communityPosts.body,
      createdAt: communityPosts.createdAt,
      reports: sql<number>`(select count(*)::int from ${communityReports} r where r.kind = 'post' and r.target_id = ${communityPosts.id})`,
    })
    .from(communityPosts)
    .where(eq(communityPosts.hidden, true))
    .orderBy(desc(communityPosts.createdAt))
    .limit(100);
  const comments = await db
    .select({
      id: communityComments.id,
      authorName: communityComments.authorName,
      body: communityComments.body,
      createdAt: communityComments.createdAt,
      reports: sql<number>`(select count(*)::int from ${communityReports} r where r.kind = 'comment' and r.target_id = ${communityComments.id})`,
    })
    .from(communityComments)
    .where(eq(communityComments.hidden, true))
    .orderBy(desc(communityComments.createdAt))
    .limit(100);
  return [
    ...posts.map((p) => ({ kind: "post" as const, id: p.id, authorName: p.authorName, text: `${p.title}\n${p.body}`, reports: p.reports, createdAt: p.createdAt })),
    ...comments.map((c) => ({ kind: "comment" as const, id: c.id, authorName: c.authorName, text: c.body, reports: c.reports, createdAt: c.createdAt })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** 관리자: 가려진 글·댓글을 되살리거나(신고 기록도 지움) 완전히 지운다. */
export async function moderate(db: Db, kind: "post" | "comment", id: number, action: "restore" | "delete"): Promise<boolean> {
  const table = kind === "post" ? communityPosts : communityComments;
  if (action === "delete") {
    const gone = await db.delete(table).where(eq(table.id, id)).returning({ id: table.id });
    return gone.length > 0;
  }
  const back = await db.update(table).set({ hidden: false }).where(and(eq(table.id, id), eq(table.hidden, true))).returning({ id: table.id });
  if (back.length > 0) {
    await db.delete(communityReports).where(and(eq(communityReports.kind, kind), eq(communityReports.targetId, id)));
  }
  return back.length > 0;
}
