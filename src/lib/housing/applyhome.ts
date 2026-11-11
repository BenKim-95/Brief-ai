import { z } from "zod";

/**
 * 한국부동산원 청약홈 분양정보 조회 서비스 (data.go.kr → api.odcloud.kr).
 * Each operation (APT, 오피스텔, 무순위 ...) is a `housing_feeds.endpoint`.
 * Field names differ a little between operations, so the mapper tries several
 * keys and keeps the original row in `raw`.
 */
export const APPLYHOME_BASE_URL =
  "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/";

export const endpointSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9]{2,80}$/, "API 오퍼레이션 이름은 영문·숫자만 쓸 수 있어요.");

const pageSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  totalCount: z.number().optional(),
  matchCount: z.number().optional(),
});

const errorSchema = z.object({ code: z.number(), msg: z.string() });

export type NoticeInput = {
  externalId: string;
  name: string;
  typeLabel: string;
  region: string | null;
  address: string | null;
  supplyCount: number | null;
  announcedOn: string | null;
  receiptStart: string | null;
  receiptEnd: string | null;
  winnerOn: string | null;
  detailUrl: string | null;
  raw: Record<string, unknown>;
};

function pickString(raw: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "number") return String(v);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Accepts "YYYY-MM-DD" or "YYYYMMDD"; anything else → null. */
export function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(value);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso
    ? null
    : iso;
}

function pickDate(raw: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const d = normalizeDate(pickString(raw, k));
    if (d) return d;
  }
  return null;
}

function pickUrl(raw: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    let v = pickString(raw, k);
    if (!v) continue;
    if (/^www\./i.test(v)) v = `https://${v}`;
    if (/^https?:\/\/\S+$/i.test(v)) return v;
  }
  return null;
}

/** Maps one API row; returns null when the identifying fields are missing. */
export function mapNotice(raw: Record<string, unknown>): NoticeInput | null {
  const manageNo = pickString(raw, "HOUSE_MANAGE_NO");
  const pblancNo = pickString(raw, "PBLANC_NO");
  const name = pickString(raw, "HOUSE_NM");
  if (!manageNo || !pblancNo || !name) return null;

  const address = pickString(raw, "HSSPLY_ADRES");
  const types = [
    pickString(raw, "HOUSE_SECD_NM"),
    pickString(raw, "HOUSE_DTL_SECD_NM"),
    pickString(raw, "RENT_SECD_NM"),
  ].filter((t): t is string => !!t);
  const supplyRaw = pickString(raw, "TOT_SUPLY_HSHLDCO");
  const supply = supplyRaw === null ? NaN : Number(supplyRaw);

  return {
    externalId: `${manageNo}-${pblancNo}`,
    name,
    typeLabel: [...new Set(types)].join(" "),
    region:
      pickString(raw, "SUBSCRPT_AREA_CODE_NM") ??
      (address ? address.split(/\s+/)[0] : null),
    address,
    supplyCount: Number.isInteger(supply) && supply >= 0 ? supply : null,
    announcedOn: pickDate(raw, "RCRIT_PBLANC_DE"),
    receiptStart: pickDate(
      raw,
      "RCEPT_BGNDE",
      "SUBSCRPT_RCEPT_BGNDE",
      "SPSPLY_RCEPT_BGNDE",
      "GNRL_RNK1_CRSPAREA_RCPTDE",
    ),
    receiptEnd: pickDate(
      raw,
      "RCEPT_ENDDE",
      "SUBSCRPT_RCEPT_ENDDE",
      "GNRL_RNK2_ETC_AREA_ENDDE",
      "GNRL_RNK1_ETC_AREA_ENDDE",
    ),
    winnerOn: pickDate(raw, "PRZWNER_PRESNATN_DE"),
    detailUrl: pickUrl(raw, "PBLANC_URL", "HMPG_ADRES"),
    raw,
  };
}

export type PageResult = { rows: Record<string, unknown>[]; totalCount: number };

export async function fetchApplyhomePage(
  endpoint: string,
  serviceKey: string,
  opts: { page: number; perPage: number; since?: string },
): Promise<PageResult> {
  const op = endpointSchema.parse(endpoint);
  const url = new URL(op, APPLYHOME_BASE_URL);
  url.searchParams.set("page", String(opts.page));
  url.searchParams.set("perPage", String(opts.perPage));
  if (opts.since) url.searchParams.set("cond[RCRIT_PBLANC_DE::GTE]", opts.since);
  url.searchParams.set("serviceKey", serviceKey);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const json: unknown = await res.json().catch(() => null);
  const err = errorSchema.safeParse(json);
  if (err.success) throw new Error(`${err.data.msg} (code ${err.data.code})`);
  if (!res.ok) throw new Error(`청약홈 API가 ${res.status} 응답을 줬어요.`);
  const page = pageSchema.safeParse(json);
  if (!page.success) throw new Error("청약홈 API 응답 형식이 예상과 달라요.");
  return {
    rows: page.data.data,
    totalCount: page.data.matchCount ?? page.data.totalCount ?? page.data.data.length,
  };
}

export const FETCH_PER_PAGE = 100;
export const FETCH_MAX_PAGES = 10;

/** All notices announced on/after `since` for one feed. */
export async function fetchApplyhomeFeed(
  endpoint: string,
  serviceKey: string,
  since: string,
): Promise<{ notices: NoticeInput[]; skipped: number }> {
  const notices: NoticeInput[] = [];
  let skipped = 0;
  for (let page = 1; page <= FETCH_MAX_PAGES; page++) {
    const { rows, totalCount } = await fetchApplyhomePage(endpoint, serviceKey, {
      page,
      perPage: FETCH_PER_PAGE,
      since,
    });
    for (const row of rows) {
      const n = mapNotice(row);
      if (n) notices.push(n);
      else skipped++;
    }
    if (rows.length < FETCH_PER_PAGE || page * FETCH_PER_PAGE >= totalCount) break;
  }
  return { notices, skipped };
}

/** Used when a feed is added/edited: can we read at least the first page? */
export async function checkApplyhomeEndpoint(
  endpoint: string,
  serviceKey: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await fetchApplyhomePage(endpoint, serviceKey, { page: 1, perPage: 1 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
