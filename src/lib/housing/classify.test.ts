import { describe, expect, it } from "vitest";
import { classifyNotice, parseKeywords } from "./classify";
import { noticeStatus, todayKst } from "./status";
import { sinceDate } from "./sync";

// Mirrors the seed in drizzle/0002_housing_seed.sql
const SEED = [
  { id: 1, keywords: ["APT 분양"] },
  { id: 2, keywords: ["무순위", "잔여세대"] },
  { id: 3, keywords: ["민간임대"] },
  { id: 4, keywords: ["오피스텔", "도시형"] },
  { id: 5, keywords: ["임의공급"] },
];

describe("classifyNotice", () => {
  it("uses the feed name and type label", () => {
    expect(classifyNotice(SEED, "APT 분양", "APT 민영 분양주택")).toBe(1);
    expect(classifyNotice(SEED, "APT 무순위·잔여세대", "APT")).toBe(2);
    expect(classifyNotice(SEED, "오피스텔·도시형", "오피스텔")).toBe(4);
  });

  it("first matching category in order wins", () => {
    expect(classifyNotice(SEED, "오피스텔·도시형", "민간임대")).toBe(3);
  });

  it("returns null (미분류) when nothing matches or keywords are blank", () => {
    expect(classifyNotice(SEED, null, "신혼희망타운")).toBeNull();
    expect(classifyNotice([{ id: 9, keywords: [" "] }], "x", "y")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(classifyNotice([{ id: 1, keywords: ["apt"] }], null, "APT")).toBe(1);
  });
});

describe("parseKeywords", () => {
  it("splits on commas/newlines, trims and dedupes", () => {
    expect(parseKeywords(" 무순위, 잔여세대\n무순위,, ")).toEqual(["무순위", "잔여세대"]);
  });
});

describe("noticeStatus", () => {
  it("computes upcoming / open / closed / unknown", () => {
    expect(noticeStatus("2026-11-10", "2026-11-13", "2026-11-09")).toBe("upcoming");
    expect(noticeStatus("2026-11-10", "2026-11-13", "2026-11-10")).toBe("open");
    expect(noticeStatus("2026-11-10", "2026-11-13", "2026-11-13")).toBe("open");
    expect(noticeStatus("2026-11-10", "2026-11-13", "2026-11-14")).toBe("closed");
    expect(noticeStatus("2026-11-10", null, "2026-11-11")).toBe("closed");
    expect(noticeStatus(null, null, "2026-11-11")).toBe("unknown");
  });

  it("uses Korean time for today", () => {
    expect(todayKst(new Date("2026-11-10T15:30:00Z"))).toBe("2026-11-11");
  });
});

describe("sinceDate", () => {
  it("subtracts days across month boundaries", () => {
    expect(sinceDate("2026-03-01", 1)).toBe("2026-02-28");
  });
});
