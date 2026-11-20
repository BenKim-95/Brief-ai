import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as s from "../src/db/schema";

export const E2E_PREFIX = "[E2E]";
export const NEWS_TOTAL = 7; // 한 페이지 6개 → 2페이지
export const NEWS_MODEL_COUNT = 4;
export const NEWS_POLICY_COUNT = 3;
export const HOUSING_TOTAL = 2;

/** 네트워크 없이 로드되는 1x1 PNG. 소식 1에 붙여 "사진이 보이는" 경우를 만든다. */
export const E2E_IMAGE_OK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
/** 열리지 않는 주소. 소식 2에 붙여 "깨진 사진은 숨는다"를 확인한다. */
export const E2E_IMAGE_BROKEN = "https://example.invalid/broken.jpg";

function hostOf(url: string) {
  return new URL(url).hostname.replace("-pooler", "");
}

/** 운영 DB(.env.local 의 DATABASE_URL)와 같은 곳이면 절대 비우지 않는다. */
function assertNotProduction(e2eUrl: string) {
  const prod: string[] = [];
  if (process.env.DATABASE_URL) prod.push(process.env.DATABASE_URL);
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL(?:_POOLED)?=(.+)$/);
      if (m) prod.push(m[1].trim().replace(/^["']|["']$/g, ""));
    }
  }
  const e2eHost = hostOf(e2eUrl);
  for (const p of prod) {
    if (p && hostOf(p) === e2eHost) {
      throw new Error(
        "E2E_DATABASE_URL이 운영 DB와 같은 주소예요. 테스트는 비우고 다시 채우기 때문에 중단했어요.",
      );
    }
  }
}

const day = (offset: number) => {
  const kst = new Date(Date.now() + 9 * 3_600_000 + offset * 86_400_000);
  return kst.toISOString().slice(0, 10);
};

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL이 없어요.");
  assertNotProduction(url);

  const db = drizzle(neon(url), { schema: s });

  // 테스트 브랜치를 항상 같은 상태로 되돌린다 (저장 → 공고/기사 → 분류 순서로 지움).
  await db.delete(s.pushSubscriptions);
  await db.delete(s.notificationSettings);
  await db.delete(s.emailSubscribers);
  await db.delete(s.savedHousingNotices);
  await db.delete(s.savedArticles);
  await db.delete(s.visitorProfiles);
  await db.delete(s.articles);
  await db.delete(s.housingNotices);
  await db.delete(s.categories);
  await db.delete(s.housingCategories);
  await db.delete(s.sources);

  const [src] = await db
    .insert(s.sources)
    .values({ name: `${E2E_PREFIX} 소스`, url: "https://example.invalid/rss", language: "ko" })
    .returning();
  const [model, policy] = await db
    .insert(s.categories)
    .values([
      { name: `${E2E_PREFIX} 모델`, description: "테스트", sortOrder: 1 },
      { name: `${E2E_PREFIX} 정책`, description: "테스트", sortOrder: 2 },
      // 기사가 하나도 없는 카테고리: 홈 카테고리 탭에서 숨겨져야 한다.
      { name: `${E2E_PREFIX} 빈 카테고리`, description: "테스트", sortOrder: 3 },
    ])
    .returning();

  const now = Date.now();
  const rows = Array.from({ length: NEWS_TOTAL }, (_, i) => {
    const isModel = i < NEWS_MODEL_COUNT;
    const n = isModel ? i + 1 : i - NEWS_MODEL_COUNT + 1;
    const label = isModel ? "모델" : "정책";
    return {
      sourceId: src.id,
      url: `https://example.invalid/e2e/${i}`,
      titleOrig: `E2E original ${i}`,
      titleKo: `${E2E_PREFIX} ${label} 소식 ${n}`,
      summaryKo: `${label} 관련 테스트 요약 ${n}이에요.`,
      // 소식 1에만 AI 해설 3줄이 있다(나머지는 아직 없는 기존 기사처럼 비워 둔다).
      ...(i === 0
        ? {
            insightOneLine: "한 줄 요약 테스트예요.",
            insightLearned: "알게 된 점 테스트예요.",
            insightPerspective: "다른 시각 테스트예요.",
          }
        : {}),
      imageUrl: i === 0 ? E2E_IMAGE_OK : i === 1 ? E2E_IMAGE_BROKEN : null,
      categoryId: isModel ? model.id : policy.id,
      // 번호가 작을수록 최신 → 1페이지에 모델 소식 1~4, 정책 소식 1~2가 온다.
      publishedAt: new Date(now - i * 3_600_000),
    };
  });
  await db.insert(s.articles).values(rows);

  const [housingCat] = await db
    .insert(s.housingCategories)
    .values({ name: `${E2E_PREFIX} 분양`, description: "테스트", keywords: [], sortOrder: 1 })
    .returning();
  await db.insert(s.housingNotices).values(
    ["A", "B"].map((k, i) => ({
      externalId: `e2e-${k}`,
      categoryId: housingCat.id,
      name: `${E2E_PREFIX} 테스트 공고 ${k}`,
      typeLabel: "APT 일반",
      region: "서울",
      address: "서울특별시 테스트구",
      supplyCount: 100 + i,
      announcedOn: day(-1),
      receiptStart: day(2 + i),
      receiptEnd: day(4 + i),
      winnerOn: day(10),
      detailUrl: "https://example.invalid/applyhome",
      raw: {},
    })),
  );
}
