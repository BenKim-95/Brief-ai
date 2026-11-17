type IcsBase = {
  uid: string;
  title: string;
  description?: string;
  url?: string;
};

/** 종일 일정 */
export type IcsAllDayEvent = IcsBase & {
  /** All-day event start, YYYY-MM-DD */
  date: string;
  /** Inclusive last day, YYYY-MM-DD; defaults to `date` */
  endDate?: string;
};

/** 시각이 정해진 일정(UTC 시각으로 적는다). 시작 시각에 알림이 울린다. */
export type IcsTimedEvent = IcsBase & {
  startAt: Date;
  /** 일정 길이(분). 기본 15 */
  minutes?: number;
};

export type IcsEvent = IcsAllDayEvent | IcsTimedEvent;

function escapeText(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const compact = (d: string) => d.replace(/-/g, "");

/** Date → 20261118T110000Z */
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

function nextDay(d: string) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/** RFC 5545 lines are folded at 75 octets; continuation lines start with a space. */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (curLen + len > limit) {
      parts.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

export function buildIcs(events: IcsEvent[], now = new Date()): string {
  const stamp = utcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//brief//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if ("startAt" in e) {
      const end = new Date(e.startAt.getTime() + (e.minutes ?? 15) * 60_000);
      lines.push(`DTSTART:${utcStamp(e.startAt)}`, `DTEND:${utcStamp(end)}`);
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${compact(e.date)}`,
        `DTEND;VALUE=DATE:${compact(nextDay(e.endDate ?? e.date))}`,
      );
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if ("startAt" in e) {
      // 시작 시각에 캘린더 앱이 알림을 띄운다.
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(e.title)}`, "TRIGGER:PT0M", "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
