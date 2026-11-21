/** 방문 통계 화면에서 쓰는 글자 만들기(순수 함수라 테스트할 수 있다). 클라이언트에서도 쓰므로 DB 코드를 끌어오지 않는다. */

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-11-21" → "11/21" */
export function dayLabel(day: string): string {
  return `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
}

/** "2026-11-21" → "11월 21일(토)" */
export function dayLong(day: string): string {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay();
  return `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일(${WEEKDAY[w]})`;
}

export function n(value: number): string {
  return value.toLocaleString("ko-KR");
}

/** 어제와 비교한 말. 변화가 없으면 "어제와 같아요". */
export function deltaText(now: number, before: number): { text: string; dir: "up" | "down" | "same" } {
  const d = now - before;
  if (d === 0) return { text: "어제와 같아요", dir: "same" };
  return d > 0 ? { text: `어제보다 ${n(d)} 늘었어요`, dir: "up" } : { text: `어제보다 ${n(-d)} 줄었어요`, dir: "down" };
}

const PAGE_NAMES: Record<string, string> = {
  "/": "뉴스 피드",
  "/five-minute": "5분 이슈",
  "/for-me": "나와 관련된 소식",
  "/community": "제보 기사",
  "/community/new": "제보 글쓰기",
  "/community/:id": "제보 글 상세",
  "/articles/:id": "뉴스 상세",
  "/saved": "저장함",
  "/my": "마이페이지",
  "/housing": "청약 일정",
  "/housing/saved": "저장한 청약",
  "/housing/:id": "청약 사진",
  "/notifications": "알림 설정",
  "/offline": "오프라인 안내",
};

/** 화면 경로를 사람이 읽는 이름으로. 모르는 경로는 경로 그대로. */
export function pathLabel(path: string): string {
  return PAGE_NAMES[path] ?? path;
}

/** 전체 대비 비율(%). 합이 0이면 0. */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
