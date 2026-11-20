import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { getDb } from "@/db";
import { categories, savedArticles, savedHousingNotices, visitorProfiles } from "@/db/schema";

type Db = ReturnType<typeof getDb>;

import { MAX_INTERESTS, NICKNAME_MAX } from "./constants";

export { MAX_INTERESTS, NICKNAME_MAX };

export const profileUpdateSchema = z.object({
  /** 비우면 기본 이름("익명 ○○○○")을 쓴다. 줄바꿈·탭 같은 제어 문자는 허용하지 않는다. */
  nickname: z
    .string()
    .trim()
    .max(NICKNAME_MAX, `닉네임은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`)
    .refine((s) => !/[\p{C}]/u.test(s), "닉네임에 쓸 수 없는 문자가 있어요."),
  interestCategoryIds: z.array(z.number().int().positive()).max(MAX_INTERESTS),
});

export type Profile = {
  nickname: string;
  interestCategoryIds: number[];
};

/** 닉네임을 정하지 않은 방문자에게 보여 줄 이름. 같은 방문자는 늘 같은 이름이다. */
export function defaultNickname(visitorId: string): string {
  const tail = visitorId.replace(/[^0-9a-f]/gi, "").slice(-4).toUpperCase();
  return `익명 ${tail}`;
}

export function displayName(visitorId: string, nickname: string | null | undefined): string {
  const n = nickname?.trim();
  return n ? n : defaultNickname(visitorId);
}

export async function getProfile(db: Db, visitorId: string | null): Promise<Profile> {
  if (!visitorId) return { nickname: "", interestCategoryIds: [] };
  const [row] = await db
    .select({ nickname: visitorProfiles.nickname, ids: visitorProfiles.interestCategoryIds })
    .from(visitorProfiles)
    .where(eq(visitorProfiles.visitorId, visitorId));
  return { nickname: row?.nickname ?? "", interestCategoryIds: row?.ids ?? [] };
}

/** 저장한다. 없는 카테고리 번호는 조용히 뺀다. */
export async function saveProfile(db: Db, visitorId: string, input: z.infer<typeof profileUpdateSchema>) {
  const wanted = [...new Set(input.interestCategoryIds)];
  const valid = wanted.length
    ? (await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, wanted))).map((r) => r.id)
    : [];
  const values = {
    visitorId,
    nickname: input.nickname,
    interestCategoryIds: wanted.filter((id) => valid.includes(id)),
    updatedAt: new Date(),
  };
  await db
    .insert(visitorProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: visitorProfiles.visitorId,
      set: { nickname: values.nickname, interestCategoryIds: values.interestCategoryIds, updatedAt: values.updatedAt },
    });
  return { nickname: values.nickname, interestCategoryIds: values.interestCategoryIds };
}

/** 마이페이지 숫자: 저장한 소식·청약 공고 개수. */
export async function countMine(db: Db, visitorId: string | null) {
  if (!visitorId) return { savedArticles: 0, savedNotices: 0 };
  const [a] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(savedArticles)
    .where(eq(savedArticles.userId, visitorId));
  const [h] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(savedHousingNotices)
    .where(eq(savedHousingNotices.userId, visitorId));
  return { savedArticles: a?.n ?? 0, savedNotices: h?.n ?? 0 };
}
