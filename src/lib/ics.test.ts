import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

describe("buildIcs", () => {
  const now = new Date("2026-11-11T01:02:03.456Z");

  it("writes all-day events with an exclusive end date", () => {
    const ics = buildIcs(
      [{ uid: "a@brief", date: "2026-11-30", endDate: "2026-12-01", title: "접수; 1,2" }],
      now,
    );
    expect(ics).toContain("DTSTAMP:20261111T010203Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130");
    expect(ics).toContain("DTEND;VALUE=DATE:20261202");
    expect(ics).toContain("SUMMARY:접수\\; 1\\,2");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("folds long lines at 75 octets", () => {
    const ics = buildIcs(
      [{ uid: "b", date: "2026-11-30", title: "가".repeat(60), description: "줄\n바꿈" }],
      now,
    );
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(ics).toContain("DESCRIPTION:줄\\n바꿈");
  });
});
