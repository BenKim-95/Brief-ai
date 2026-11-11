import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkApplyhomeEndpoint,
  fetchApplyhomeFeed,
  fetchApplyhomePage,
  mapNotice,
  normalizeDate,
} from "./applyhome";

const APT_ROW = {
  HOUSE_MANAGE_NO: "2026000123",
  PBLANC_NO: 2026000123,
  HOUSE_NM: "예시 아파트",
  HOUSE_SECD_NM: "APT",
  HOUSE_DTL_SECD_NM: "민영",
  RENT_SECD_NM: "분양주택",
  SUBSCRPT_AREA_CODE_NM: "서울",
  HSSPLY_ADRES: "서울특별시 강남구 어딘가 1",
  TOT_SUPLY_HSHLDCO: 120,
  RCRIT_PBLANC_DE: "2026-11-01",
  RCEPT_BGNDE: "2026-11-10",
  RCEPT_ENDDE: "2026-11-13",
  PRZWNER_PRESNATN_DE: "2026-11-20",
  PBLANC_URL: "https://www.applyhome.co.kr/x?id=1",
};

describe("normalizeDate", () => {
  it("accepts dashed and compact dates", () => {
    expect(normalizeDate("2026-11-10")).toBe("2026-11-10");
    expect(normalizeDate("20261110")).toBe("2026-11-10");
  });
  it("rejects invalid dates", () => {
    expect(normalizeDate("2026-02-30")).toBeNull();
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate("미정")).toBeNull();
  });
});

describe("mapNotice", () => {
  it("maps an APT row", () => {
    const n = mapNotice(APT_ROW)!;
    expect(n).toMatchObject({
      externalId: "2026000123-2026000123",
      name: "예시 아파트",
      typeLabel: "APT 민영 분양주택",
      region: "서울",
      supplyCount: 120,
      announcedOn: "2026-11-01",
      receiptStart: "2026-11-10",
      receiptEnd: "2026-11-13",
      winnerOn: "2026-11-20",
      detailUrl: "https://www.applyhome.co.kr/x?id=1",
    });
    expect(n.raw).toBe(APT_ROW);
  });

  it("falls back to SUBSCRPT_RCEPT_* dates and region from address", () => {
    const n = mapNotice({
      HOUSE_MANAGE_NO: "1",
      PBLANC_NO: "2",
      HOUSE_NM: "오피스텔",
      HOUSE_SECD_NM: "오피스텔",
      HSSPLY_ADRES: "경기도 성남시",
      SUBSCRPT_RCEPT_BGNDE: "2026-12-01",
      SUBSCRPT_RCEPT_ENDDE: "2026-12-02",
      HMPG_ADRES: "www.example.com",
    })!;
    expect(n.region).toBe("경기도");
    expect(n.receiptStart).toBe("2026-12-01");
    expect(n.receiptEnd).toBe("2026-12-02");
    expect(n.detailUrl).toBe("https://www.example.com");
    expect(n.supplyCount).toBeNull();
  });

  it("skips rows without identifying fields", () => {
    expect(mapNotice({ HOUSE_NM: "x" })).toBeNull();
  });
});

describe("fetchApplyhomePage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds the request URL and parses data", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: [APT_ROW], matchCount: 1, totalCount: 999 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchApplyhomePage("getAPTLttotPblancDetail", "k+/=", {
      page: 2,
      perPage: 50,
      since: "2026-05-01",
    });
    expect(r).toEqual({ rows: [APT_ROW], totalCount: 1 });
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe("/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail");
    expect(url.searchParams.get("serviceKey")).toBe("k+/=");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("cond[RCRIT_PBLANC_DE::GTE]")).toBe("2026-05-01");
  });

  it("surfaces API error messages", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ code: -401, msg: "유효하지 않은 인증키 입니다." }, { status: 401 }),
    );
    await expect(
      fetchApplyhomePage("getAPTLttotPblancDetail", "bad", { page: 1, perPage: 1 }),
    ).rejects.toThrow("유효하지 않은 인증키");
    expect(await checkApplyhomeEndpoint("getAPTLttotPblancDetail", "bad")).toMatchObject({
      ok: false,
    });
  });

  it("rejects endpoint names that could change the path", async () => {
    await expect(
      fetchApplyhomePage("../other", "k", { page: 1, perPage: 1 }),
    ).rejects.toThrow();
  });
});

describe("fetchApplyhomeFeed", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("pages until fewer rows than perPage and counts skipped rows", async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ ...APT_ROW, PBLANC_NO: i }));
    const pages = [full, [APT_ROW, { HOUSE_NM: "broken" }]];
    const fetchMock = vi.fn(async () =>
      Response.json({ data: pages.shift() ?? [], matchCount: 102 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchApplyhomeFeed("getAPTLttotPblancDetail", "k", "2026-05-01");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.notices).toHaveLength(101);
    expect(r.skipped).toBe(1);
  });
});
