import { eq } from "drizzle-orm";
import type { getDb } from "@/db";
import { housingNotices } from "@/db/schema";
import { getNaverCredentials, type NaverCredentials } from "@/lib/naver";
import { enlargeThumbnail, nameTokens } from "./image";

type Db = ReturnType<typeof getDb>;

/** 사진 모음의 갈래. 순서가 화면에 나오는 순서다. */
export const PHOTO_KINDS = ["조감도", "평면도", "배치도", "모델하우스"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export type HousingPhoto = {
  kind: PhotoKind;
  /** 작은 사진(https). 화면에 보이는 것 */
  thumb: string;
  /** 원본 사진 주소(http/https). "원본 보기"로 연다 */
  link: string;
  title: string;
};
export type HousingPhotos = { checkedAt: string; items: HousingPhoto[] };

/** 갈래마다 보여 줄 최대 장수. */
export const PHOTOS_PER_KIND = 6;
/** 찾아봤는데 하나도 없을 때, 이 기간이 지나면 다시 찾아본다. */
const RETRY_EMPTY_DAYS = 7;
const TIMEOUT_MS = 6000;

/** 갈래별 검색어. */
export function photoQueries(name: string, kind: PhotoKind): string {
  const n = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return `${n} ${kind === "배치도" ? "단지배치도" : kind}`;
}

/** 광고·시세·분양 상담 같은 것이 제목에 있으면 제외한다. */
const AD = /광고|\[카드\]|카드뉴스|상담|문의|할인|특가|혜택|이벤트|시세|가격|매매|전세|월세|대출|투자|수익|프리미엄|경쟁률|당첨|홍보|전단|리플렛|전화|예약|방문|보류지|매각|실거래/;

const KIND_WORDS: Record<PhotoKind, RegExp> = {
  조감도: /조감도|투시도|전경|외관|단지\s?(사진|모습)|아파트\s?사진/,
  평면도: /평면도|평면|도면/,
  배치도: /배치도/,
  모델하우스: /모델하우스|견본주택|견본\s?세대|유니트|유닛|인테리어/,
};

type Item = { title?: unknown; link?: unknown; thumbnail?: unknown; sizewidth?: unknown; sizeheight?: unknown };

function plain(s: unknown): string {
  return typeof s === "string" ? s.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim() : "";
}

function isHttp(u: unknown): u is string {
  return typeof u === "string" && /^https?:\/\//i.test(u);
}

/**
 * 검색 결과 한 건이 이 단지의 `kind` 사진으로 알맞으면 정리된 사진을, 아니면 null.
 * 제목에 단지 이름(구분이 되는 말 전부)과 갈래를 뜻하는 말이 모두 있어야 하고, 광고성 제목은 뺀다.
 */
export function toPhoto(it: Item, name: string, kind: PhotoKind): HousingPhoto | null {
  const tokens = nameTokens(name);
  if (tokens.length === 0) return null;
  const title = plain(it.title);
  const spaceless = title.replace(/\s+/g, "");
  if (!tokens.every((t) => spaceless.includes(t))) return null;
  if (AD.test(title) || !KIND_WORDS[kind].test(title)) return null;
  if (typeof it.thumbnail !== "string" || !it.thumbnail.startsWith("https://") || !isHttp(it.link)) return null;
  const w = Number(it.sizewidth);
  const h = Number(it.sizeheight);
  if (!(w >= 300 && h >= 200)) return null;
  return { kind, thumb: enlargeThumbnail(it.thumbnail), link: it.link, title: title.slice(0, 120) };
}

/** 검색 결과에서 `kind`에 맞는 사진을 최대 `PHOTOS_PER_KIND`장 고른다(같은 사진은 한 번만). */
export function pickPhotos(items: unknown, name: string, kind: PhotoKind, seen = new Set<string>()): HousingPhoto[] {
  if (!Array.isArray(items)) return [];
  const out: HousingPhoto[] = [];
  for (const it of items as Item[]) {
    const p = toPhoto(it, name, kind);
    if (!p || seen.has(p.thumb)) continue;
    seen.add(p.thumb);
    out.push(p);
    if (out.length >= PHOTOS_PER_KIND) break;
  }
  return out;
}

async function searchOne(query: string, creds: NaverCredentials): Promise<unknown> {
  const url = new URL(`${creds.baseUrl}/search/v1/image`);
  url.searchParams.set("query", query);
  url.searchParams.set("display", "40");
  url.searchParams.set("filter", "all");
  const res = await fetch(url, {
    headers: { "X-NCP-APIGW-API-KEY-ID": creds.id, "X-NCP-APIGW-API-KEY": creds.secret },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`네이버 이미지 검색 ${res.status}`);
  return ((await res.json()) as { items?: unknown }).items;
}

/** 갈래별로 검색해 사진을 모은다. 하나라도 검색이 실패하면 던진다(일부만 저장해 "없음"으로 굳지 않게). */
export async function searchHousingPhotos(name: string, creds: NaverCredentials): Promise<HousingPhoto[]> {
  const seen = new Set<string>();
  const results = await Promise.all(PHOTO_KINDS.map((k) => searchOne(photoQueries(name, k), creds)));
  return PHOTO_KINDS.flatMap((kind, i) => pickPhotos(results[i], name, kind, seen));
}

/** 저장된 검색 결과를 다시 찾아야 하는지: 한 번도 안 찾았거나, 비어 있는데 일주일이 지났거나. */
export function needsPhotoSearch(photos: HousingPhotos | null | undefined, now = new Date()): boolean {
  if (!photos) return true;
  if (photos.items.length > 0) return false;
  const checked = Date.parse(photos.checkedAt);
  return !Number.isFinite(checked) || now.getTime() - checked > RETRY_EMPTY_DAYS * 86_400_000;
}

export type PhotosOutcome =
  | { status: "ok"; photos: HousingPhoto[] }
  | { status: "no-key" }
  | { status: "error"; message: string };

/**
 * 공고의 사진 모음을 돌려준다. 저장돼 있으면 그대로, 아니면 이때 검색해서 저장한다.
 * 검색 키가 없거나 검색이 실패하면 저장하지 않고 이유를 돌려준다(다음에 다시 시도).
 */
export async function getHousingPhotos(
  db: Db,
  notice: { id: number; name: string; photos: HousingPhotos | null },
  now = new Date(),
): Promise<PhotosOutcome> {
  if (!needsPhotoSearch(notice.photos, now)) return { status: "ok", photos: notice.photos?.items ?? [] };
  const creds = getNaverCredentials();
  if (!creds) return { status: "no-key" };
  try {
    const items = await searchHousingPhotos(notice.name, creds);
    const photos: HousingPhotos = { checkedAt: now.toISOString(), items };
    await db.update(housingNotices).set({ photos }).where(eq(housingNotices.id, notice.id));
    return { status: "ok", photos: items };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "사진을 찾지 못했어요." };
  }
}

/** 갈래별로 묶는다(비어 있는 갈래는 뺀다). */
export function groupByKind(photos: HousingPhoto[]): { kind: PhotoKind; photos: HousingPhoto[] }[] {
  return PHOTO_KINDS.map((kind) => ({ kind, photos: photos.filter((p) => p.kind === kind) })).filter((g) => g.photos.length > 0);
}

export function hostOfLink(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
