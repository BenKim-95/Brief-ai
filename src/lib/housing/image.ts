import type { getDb } from "@/db";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { housingNotices } from "@/db/schema";
import { todayKst } from "./status";
import { getNaverCredentials, type NaverCredentials } from "@/lib/naver";

type Db = ReturnType<typeof getDb>;

const TIMEOUT_MS = 5000;
/** 한 번 가져오기에서 사진을 찾아볼 공고 수 (네이버 일일 호출 한도 보호). */
export const IMAGE_LOOKUPS_PER_RUN = 40;
const PARALLEL = 4;
/** 찾아봤지만 알맞은 사진이 없을 때 저장하는 값. 화면에는 나오지 않고, 다시 검색하지 않는다. */
export const NO_IMAGE = "";

/** 단지 이름으로 사진을 찾기 위한 검색어들. 앞에서부터 시도한다. */
export function imageQueries(name: string): string[] {
  const n = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return [`${n} 조감도`, n];
}

/** 제목에 이런 말이 있으면 아파트 사진·조감도로 본다. */
const WANTED = /조감도|투시도|전경|외관|단지\s?(사진|모습)|아파트\s?사진/;
/**
 * 기사·후기 사진은 제목이 기사 제목이라 위 말이 없어도, 아래 주소에서 온 것이면
 * 단지 이름이 제목에 있을 때 단지 사진으로 본다 (언론 보도사진, 입주민 후기 사진).
 */
const TRUSTED_HOSTS = ["imgnews.naver.net", "image.hogangnono.com"];
/** 광고·시세·카드뉴스·평면도·모델하우스처럼 아파트 사진이 아닌 것에 흔한 말. 하나라도 있으면 제외한다. */
const UNWANTED =
  /광고|\[카드\]|카드뉴스|상담|문의|할인|특가|혜택|이벤트|시세|가격|매매|전세|월세|대출|투자|수익|프리미엄|경쟁률|당첨|평면|도면|배치도|견본|모델하우스|홍보|전단|리플렛|전화|예약|방문|보류지|매각|실거래/;

type Item = {
  title?: unknown;
  link?: unknown;
  thumbnail?: unknown;
  sizewidth?: unknown;
  sizeheight?: unknown;
};

function hostOf(link: unknown): string {
  try {
    return typeof link === "string" ? new URL(link).hostname : "";
  } catch {
    return "";
  }
}

function plain(s: unknown): string {
  return typeof s === "string" ? s.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ") : "";
}

/** 단지 이름에서 구분에 쓰이는 흔한 말. 사진 제목에 있는지 볼 때 뺀다. */
const GENERIC = /^(아파트|APT|신혼희망타운|공공분양|공공분양주택|민간분양|본청약|사전청약|블록|BL|지구|단지|[0-9A-Za-z-]{1,6}(블록|BL))$/i;

/** 단지 이름에서 사진 제목에 꼭 있어야 하는 말들. 비면 사진을 붙이지 않는다. */
export function nameTokens(name: string): string[] {
  if (/^샘플/.test(name.trim())) return [];
  return name
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !GENERIC.test(t));
}

/** 광고가 아닌 풍경형(가로가 긴) 아파트 사진으로 볼 수 있는가. */
export function isWantedImage(it: Item, name: string): boolean {
  const title = plain(it.title);
  const tokens = nameTokens(name);
  const spaceless = title.replace(/\s+/g, "");
  if (tokens.length === 0 || !tokens.every((t) => spaceless.includes(t))) return false;
  if (UNWANTED.test(title)) return false;
  if (!WANTED.test(title) && !TRUSTED_HOSTS.includes(hostOf(it.link))) return false;
  const w = Number(it.sizewidth);
  const h = Number(it.sizeheight);
  if (!(w >= 500 && h > 0)) return false;
  const ratio = w / h;
  return ratio >= 1.2 && ratio <= 2;
}

/** 네이버 썸네일은 기본 150px라 흐리다. 같은 주소에서 360px 판(b360)을 쓸 수 있다. */
export function enlargeThumbnail(url: string): string {
  return url.replace(/([?&]type=)b150(&|$)/, "$1b360$2");
}

/** 알맞은 사진 중 첫 번째의 https 썸네일을 큰 판으로 돌려준다. */
export function pickThumbnail(items: unknown, name: string): string | null {
  if (!Array.isArray(items)) return null;
  for (const it of items as Item[]) {
    if (!isWantedImage(it, name)) continue;
    const t = it.thumbnail;
    if (typeof t === "string" && t.startsWith("https://")) return enlargeThumbnail(t);
  }
  return null;
}

export async function searchHousingImage(
  name: string,
  creds: NaverCredentials,
): Promise<string | null> {
  for (const query of imageQueries(name)) {
    const url = new URL(`${creds.baseUrl}/search/v1/image`);
    url.searchParams.set("query", query);
    url.searchParams.set("display", "30");
    url.searchParams.set("filter", "large");
    const res = await fetch(url, {
      headers: { "X-NCP-APIGW-API-KEY-ID": creds.id, "X-NCP-APIGW-API-KEY": creds.secret },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`네이버 이미지 검색 ${res.status}`);
    const body = (await res.json()) as { items?: unknown };
    const found = pickThumbnail(body.items, name);
    if (found) return found;
  }
  return null;
}

/**
 * 사진을 아직 찾아본 적 없는 공고에 네이버 이미지 검색 결과를 채운다. 키가 없으면 아무것도 하지 않는다.
 * 알맞은 사진이 없으면 NO_IMAGE를 저장해 다시 찾지 않는다. 한 건이 실패해도 나머지는 계속한다.
 */
export async function fillHousingImages(db: Db): Promise<{ checked: number; filled: number; error?: string }> {
  const creds = getNaverCredentials();
  if (!creds) return { checked: 0, filled: 0 };
  const rows = await db
    .select({ id: housingNotices.id, name: housingNotices.name })
    .from(housingNotices)
    .where(isNull(housingNotices.imageUrl))
    // 화면에 먼저 보이는 접수 중·예정 공고부터 사진을 찾는다.
    .orderBy(
      sql`case when coalesce(${housingNotices.receiptEnd}, ${housingNotices.receiptStart}) >= ${todayKst()} then 0 else 1 end`,
      desc(housingNotices.receiptStart),
      desc(housingNotices.id),
    )
    .limit(IMAGE_LOOKUPS_PER_RUN);

  let filled = 0;
  let error: string | undefined;
  for (let i = 0; i < rows.length; i += PARALLEL) {
    await Promise.all(
      rows.slice(i, i + PARALLEL).map(async (r) => {
        try {
          const url = await searchHousingImage(r.name, creds);
          await db
            .update(housingNotices)
            .set({ imageUrl: url ?? NO_IMAGE })
            .where(eq(housingNotices.id, r.id));
          if (url) filled++;
        } catch (e) {
          error ??= e instanceof Error ? e.message : String(e);
        }
      }),
    );
  }
  return { checked: rows.length, filled, error };
}
