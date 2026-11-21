import { describe, expect, it } from "vitest";
import { deltaText, dayLabel, dayLong, pathLabel, percent } from "./format";
import { cleanVisitPath, dayList, fillDays, fillHours, isBotAgent, kstDayOf, kstHourOf, shiftDay } from "./store";

describe("한국 시간 날짜·시", () => {
  it("UTC 15시 이후는 한국에서 다음 날이다", () => {
    expect(kstDayOf(new Date("2026-11-20T14:59:00Z"))).toBe("2026-11-20");
    expect(kstDayOf(new Date("2026-11-20T15:00:00Z"))).toBe("2026-11-21");
    expect(kstHourOf(new Date("2026-11-20T15:00:00Z"))).toBe(0);
    expect(kstHourOf(new Date("2026-11-20T14:30:00Z"))).toBe(23);
  });
  it("날짜 더하기·목록", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayList("2026-11-19", "2026-11-21")).toEqual(["2026-11-19", "2026-11-20", "2026-11-21"]);
  });
});

describe("빈 날·빈 시간 채우기", () => {
  it("기록이 없는 날은 0으로 채운다", () => {
    const rows = fillDays([{ day: "2026-11-20", visitors: 2, pageViews: 5 }], "2026-11-19", "2026-11-21");
    expect(rows).toEqual([
      { day: "2026-11-19", visitors: 0, pageViews: 0 },
      { day: "2026-11-20", visitors: 2, pageViews: 5 },
      { day: "2026-11-21", visitors: 0, pageViews: 0 },
    ]);
  });
  it("시간은 항상 24칸", () => {
    const rows = fillHours([{ hour: 9, visitors: 1, pageViews: 3 }]);
    expect(rows).toHaveLength(24);
    expect(rows[9].pageViews).toBe(3);
    expect(rows[10].pageViews).toBe(0);
  });
});

describe("세지 않을 요청", () => {
  it("봇·빈 UA는 센다고 보지 않는다", () => {
    expect(isBotAgent(null)).toBe(true);
    expect(isBotAgent("Googlebot/2.1")).toBe(true);
    expect(isBotAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36")).toBe(false);
    expect(isBotAgent("Mozilla/5.0 HeadlessChrome/120.0")).toBe(false);
  });
  it("관리·API 경로와 이상한 값은 null, 쿼리는 떼고 숫자는 :id", () => {
    expect(cleanVisitPath("/admin")).toBeNull();
    expect(cleanVisitPath("/admin/errors")).toBeNull();
    expect(cleanVisitPath("/api/x")).toBeNull();
    expect(cleanVisitPath("//evil.com")).toBeNull();
    expect(cleanVisitPath("https://x.com/")).toBeNull();
    expect(cleanVisitPath("")).toBeNull();
    expect(cleanVisitPath(5)).toBeNull();
    expect(cleanVisitPath("/")).toBe("/");
    expect(cleanVisitPath("/articles/42?utm=1#a")).toBe("/articles/:id");
    expect(cleanVisitPath("/housing/saved/")).toBe("/housing/saved");
    expect(cleanVisitPath("/administrator")).toBe("/administrator");
  });
});

describe("화면 글자", () => {
  it("날짜", () => {
    expect(dayLabel("2026-11-05")).toBe("11/5");
    expect(dayLong("2026-11-21")).toBe("11월 21일(토)");
  });
  it("어제와 비교", () => {
    expect(deltaText(5, 5)).toEqual({ text: "어제와 같아요", dir: "same" });
    expect(deltaText(8, 5)).toEqual({ text: "어제보다 3 늘었어요", dir: "up" });
    expect(deltaText(2, 5)).toEqual({ text: "어제보다 3 줄었어요", dir: "down" });
  });
  it("화면 이름과 비율", () => {
    expect(pathLabel("/five-minute")).toBe("5분 이슈");
    expect(pathLabel("/mystery")).toBe("/mystery");
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});
