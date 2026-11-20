// Sample (fake) data for development. Safe to re-run; remove with:
//   DELETE FROM sources WHERE url LIKE 'https://example.com/%'; (articles keep source_id null)
//   DELETE FROM articles WHERE url LIKE 'https://example.com/%';
//   DELETE FROM housing_notices WHERE external_id LIKE 'SAMPLE-%';
//   DELETE FROM categories WHERE name IN (...sample names...);
import { inArray } from "drizzle-orm";
import { getDb } from "../src/db";
import {
  articles,
  categories,
  housingCategories,
  housingFeeds,
  housingNotices,
  savedArticles,
  sources,
} from "../src/db/schema";

try {
  process.loadEnvFile(".env.local");
} catch {}

// 운영 DB에 샘플 데이터가 섞여 들어간 적이 있어서, 명시적으로 허락해야만 실행된다.
// 개발용 DB에서만: ALLOW_SAMPLE_SEED=1 npx tsx scripts/seed-sample.ts
if (process.env.ALLOW_SAMPLE_SEED !== "1") {
  console.error("샘플 데이터를 넣지 않았어요. 개발용 DB가 맞다면 ALLOW_SAMPLE_SEED=1 을 붙여 다시 실행하세요.");
  process.exit(1);
}

const db = getDb();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

const glossary = (items: [string, string][]) =>
  "\n\n📖 용어\n" + items.map(([t, m]) => `· ${t}: ${m}`).join("\n");

async function main() {
  await db
    .insert(sources)
    .values([
      { name: "샘플 부동산 뉴스", url: "https://example.com/rss/realestate.xml", language: "ko" },
      { name: "샘플 국토교통 정책", url: "https://example.com/rss/policy.xml", language: "ko" },
      { name: "Sample Housing Weekly", url: "https://example.com/rss/housing-en.xml", language: "en" },
    ])
    .onConflictDoNothing();

  await db
    .insert(categories)
    .values([
      { name: "청약·분양", description: "청약 제도와 분양 일정 소식", sortOrder: 0 },
      { name: "부동산 정책", description: "대출·세제·규제 등 정책 변화", sortOrder: 1 },
      { name: "금리·대출", description: "주택담보대출과 금리 소식", sortOrder: 2 },
      { name: "시장 동향", description: "거래량·전세·월세 흐름", sortOrder: 3 },
      { name: "공급·재건축", description: "신규 공급, 재건축·재개발", sortOrder: 4 },
    ])
    .onConflictDoNothing();

  const src = Object.fromEntries(
    (await db.select().from(sources)).map((s) => [s.name, s.id]),
  );
  const cat = Object.fromEntries(
    (await db.select().from(categories)).map((c) => [c.name, c.id]),
  );

  await db
    .insert(articles)
    .values([
      {
        sourceId: src["샘플 국토교통 정책"],
        url: "https://example.com/news/1",
        titleOrig: "청약 가점제 개편안 발표",
        titleKo: "청약 가점제 산정 방식이 바뀌어요",
        summaryKo:
          "무주택 기간과 부양가족 수를 계산하는 기준이 일부 달라진다고 해요. 새 기준은 다음 분기 공고부터 적용될 예정이에요." +
          glossary([
            ["가점제", "무주택 기간·부양가족·청약통장 가입 기간을 점수로 매겨 높은 순으로 당첨자를 정하는 방식이에요."],
            ["부양가족", "청약 신청자가 부양하는 배우자·자녀·부모 등을 말해요."],
          ]),
        categoryId: cat["청약·분양"],
        publishedAt: daysAgo(1),
      },
      {
        sourceId: src["샘플 부동산 뉴스"],
        url: "https://example.com/news/2",
        titleOrig: "아파트 거래량 2개월 연속 증가",
        titleKo: "전국 아파트 거래량이 두 달 연속 늘었어요",
        summaryKo:
          "지난달 전국 아파트 거래 건수가 전월보다 늘었다는 통계가 나왔어요. 지역별로 증가 폭은 서로 달랐어요." +
          glossary([
            ["거래량", "일정 기간 동안 실제로 계약이 이뤄진 건수예요."],
            ["실거래가 신고", "거래 후 30일 안에 가격을 신고하는 제도예요."],
          ]),
        categoryId: cat["시장 동향"],
        publishedAt: daysAgo(2),
      },
      {
        sourceId: src["샘플 부동산 뉴스"],
        url: "https://example.com/news/3",
        titleOrig: "주담대 가산금리 산정 체계 손질",
        titleKo: "주택담보대출 금리 산정 기준이 조정돼요",
        summaryKo:
          "은행이 대출 금리에 붙이는 가산금리의 산정 항목을 정리하기로 했어요. 대출을 받을 때 금리가 어떻게 정해지는지 더 알기 쉬워질 수 있어요." +
          glossary([
            ["가산금리", "기준금리에 은행이 비용·위험을 반영해 더하는 금리예요."],
            ["주담대", "주택담보대출의 줄임말이에요."],
          ]),
        categoryId: cat["금리·대출"],
        publishedAt: daysAgo(3),
      },
      {
        sourceId: src["Sample Housing Weekly"],
        url: "https://example.com/news/4",
        titleOrig: "Monthly rent share keeps rising in Seoul",
        titleKo: "서울 임대차 시장에서 월세 비중이 계속 늘고 있어요",
        summaryKo:
          "서울에서 전세 대신 월세로 계약하는 비율이 이어서 높아졌다는 분석이에요. 전세 보증금 부담이 이유 중 하나로 꼽혔어요." +
          glossary([
            ["전세", "큰 보증금을 맡기고 월세 없이 거주하는 한국식 임대 방식이에요."],
            ["월세", "보증금과 함께 매달 집세를 내는 방식이에요. (영문 monthly rent의 번역)"],
          ]),
        categoryId: cat["시장 동향"],
        publishedAt: daysAgo(5),
      },
      {
        sourceId: src["샘플 국토교통 정책"],
        url: "https://example.com/news/5",
        titleOrig: "공공분양 신규 공급 계획 공개",
        titleKo: "공공분양 신규 공급 계획이 공개됐어요",
        summaryKo:
          "수도권을 중심으로 공공분양 주택을 단계적으로 공급한다는 계획이에요. 구체적 지구와 일정은 이후 공고에서 확인할 수 있어요." +
          glossary([
            ["공공분양", "공공기관이 공급하는 분양 주택이에요."],
            ["공급 계획", "앞으로 지을 주택 물량과 시기를 미리 밝힌 계획이에요."],
          ]),
        categoryId: cat["공급·재건축"],
        publishedAt: daysAgo(7),
      },
      {
        sourceId: src["샘플 부동산 뉴스"],
        url: "https://example.com/news/6",
        titleOrig: "재건축 안전진단 절차 안내",
        titleKo: "재건축 안전진단 절차를 알려 드려요",
        summaryKo:
          "재건축을 추진할 때 거치는 안전진단의 단계를 설명한 기사예요." +
          glossary([
            ["안전진단", "건물의 구조 안전성을 점검해 재건축 필요 여부를 판단하는 절차예요."],
          ]),
        categoryId: null, // 미분류 예시
        publishedAt: daysAgo(10),
      },
    ])
    .onConflictDoNothing();

  const arts = await db
    .select({ id: articles.id, url: articles.url })
    .from(articles)
    .where(inArray(articles.url, ["https://example.com/news/1", "https://example.com/news/3"]));
  const aid = Object.fromEntries(arts.map((a) => [a.url, a.id]));
  await db
    .insert(savedArticles)
    .values([
      { articleId: aid["https://example.com/news/1"], userId: null, note: "청약 전에 다시 읽기" },
      { articleId: aid["https://example.com/news/3"], userId: null, note: null },
    ])
    .onConflictDoNothing();

  const feed = Object.fromEntries(
    (await db.select().from(housingFeeds)).map((f) => [f.name, f.id]),
  );
  const hcat = Object.fromEntries(
    (await db.select().from(housingCategories)).map((c) => [c.name, c.id]),
  );

  const notice = (
    n: number,
    feedName: string,
    catName: string,
    name: string,
    typeLabel: string,
    region: string,
    address: string,
    supplyCount: number,
    announcedOn: string,
    receiptStart: string,
    receiptEnd: string,
    winnerOn: string,
    summary: string,
    terms: [string, string][],
  ) => ({
    externalId: `SAMPLE-2026-00${n}`,
    feedId: feed[feedName],
    categoryId: hcat[catName],
    name,
    typeLabel,
    region,
    address,
    supplyCount,
    announcedOn,
    receiptStart,
    receiptEnd,
    winnerOn,
    detailUrl: `https://example.com/housing/${n}`,
    raw: {
      sample: true,
      summary_ko: summary,
      glossary: terms.map(([term, meaning]) => ({ term, meaning })),
    },
  });

  await db
    .insert(housingNotices)
    .values([
      notice(1, "APT 분양", "APT 분양", "샘플 푸르지오 파크", "APT 민영 분양주택", "경기",
        "경기도 샘플시 예제로 100", 842, "2026-11-10", "2026-11-17", "2026-11-19", "2026-11-26",
        "일반공급 위주 단지예요.",
        [["특별공급", "신혼부부·다자녀 등 조건을 갖춘 사람에게 따로 배정하는 물량이에요."],
         ["청약통장", "청약 신청에 필요한 저축 통장이에요."]]),
      notice(2, "APT 무순위·잔여세대", "무순위·잔여세대", "샘플 힐스테이트 잔여세대", "APT 무순위", "서울",
        "서울특별시 샘플구 예제길 22", 12, "2026-11-12", "2026-11-20", "2026-11-20", "2026-11-24",
        "무순위는 청약 통장 없이 신청 가능한 경우가 많아요.",
        [["무순위", "1·2순위에서 남은 물량을 다시 공급하는 것이에요."],
         ["잔여세대", "계약이 안 되어 남은 세대예요."]]),
      notice(3, "오피스텔·도시형", "오피스텔·도시형", "샘플 센트럴 오피스텔", "오피스텔", "부산",
        "부산광역시 샘플구 예제대로 5", 150, "2026-11-18", "2026-11-25", "2026-11-26", "2026-12-03",
        "오피스텔은 청약 통장이 필요 없어요.",
        [["오피스텔", "업무와 주거를 함께 할 수 있는 건물이에요."],
         ["전용면적", "실제 생활에 쓰는 면적이에요."]]),
      notice(4, "공공지원 민간임대", "민간임대", "샘플 리버뷰 공공지원 민간임대", "공공지원 민간임대", "인천",
        "인천광역시 샘플구 예제로 77", 320, "2026-11-24", "2026-12-01", "2026-12-03", "2026-12-10",
        "공공지원 민간임대 공고 예시예요.",
        [["공공지원 민간임대", "민간이 짓고 공공이 지원해 임대하는 주택이에요."],
         ["임대 의무기간", "팔 수 없이 임대해야 하는 기간이에요."]]),
      notice(5, "임의공급", "임의공급", "샘플 타운 임의공급", "임의공급", "대전",
        "대전광역시 샘플구 예제로 9", 30, "2026-11-05", "2026-11-14", "2026-11-15", "2026-11-21",
        "접수가 끝나가는 공고 예시예요.",
        [["임의공급", "청약 절차 없이 사업주체가 정한 방식으로 공급하는 것이에요."]]),
    ])
    .onConflictDoNothing();
}

main().then(
  () => console.log("sample data seeded"),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
