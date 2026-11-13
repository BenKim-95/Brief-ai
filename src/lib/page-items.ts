export type PageItem = number | "gap";

/**
 * 표시할 페이지 번호 목록. 항상 첫/마지막 페이지를 넣고, 현재 페이지 앞뒤 `around`개씩 보여줘요.
 * 첫/마지막 페이지와 번호가 이어지지 않으면 "gap"(…)을 끼워 넣고, 이어지면 생략해요.
 * 예) 50 / 100 → [1, "gap", 48, 49, 50, 51, 52, "gap", 100]
 */
export function pageItems(page: number, totalPages: number, around = 2): PageItem[] {
  if (totalPages < 1) return [];
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages);
  const start = Math.max(1, current - around);
  const end = Math.min(totalPages, current + around);

  const items: PageItem[] = [];
  if (start > 1) {
    items.push(1);
    if (start > 2) items.push("gap");
  }
  for (let n = start; n <= end; n++) items.push(n);
  if (end < totalPages) {
    if (end < totalPages - 1) items.push("gap");
    items.push(totalPages);
  }
  return items;
}
