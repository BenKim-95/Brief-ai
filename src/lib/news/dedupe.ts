/** 같은 기사를 다른 주소·다른 언론사로 또 가져오지 않도록 하는 순수 함수들. */

const TRACKING = /^(utm_|fbclid$|gclid$|igshid$|mc_|ref$|ref_src$|spm$|from$|cmpid$|ocid$)/i;

/** 추적 파라미터·해시·www·끝 슬래시를 없앤 비교용 URL. 파싱 실패 시 원문. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const keep = [...u.searchParams.entries()]
      .filter(([k]) => !TRACKING.test(k))
      .sort(([a], [b]) => a.localeCompare(b));
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);
    let s = `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
    if (u.protocol === "http:") s = s.replace(/^http:/, "https:");
    return s;
  } catch {
    return raw.trim();
  }
}

/** 제목 비교용: 소문자, [속보] 같은 말머리·" - 언론사" 꼬리·기호 제거. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\[[^\]]{1,12}\]|\([^)]{1,12}\)|【[^】]{1,12}】/g, " ")
    .replace(/\s[-–—|]\s[^-–—|]{1,25}$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** 글자 2-gram Dice 계수 (0~1). */
export function titleSimilarity(a: string, b: string): number {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const gx = bigrams(x);
  const gy = bigrams(y);
  let overlap = 0;
  for (const [g, n] of gx) overlap += Math.min(n, gy.get(g) ?? 0);
  return (2 * overlap) / (x.length - 1 + (y.length - 1));
}

export const TITLE_DUP_THRESHOLD = 0.7;
const MIN_TITLE_LEN = 8; // 너무 짧은 제목은 우연히 비슷해지기 쉬워 정확히 같을 때만 중복

export function isSimilarTitle(a: string, b: string): boolean {
  const s = titleSimilarity(a, b);
  if (s === 1) return true;
  if (normalizeTitle(a).length < MIN_TITLE_LEN || normalizeTitle(b).length < MIN_TITLE_LEN) {
    return false;
  }
  return s >= TITLE_DUP_THRESHOLD;
}

/** `pool` 중 하나라도 `title`과 비슷하면 true. */
export function hasSimilarTitle(title: string, pool: Iterable<string>): boolean {
  for (const t of pool) if (isSimilarTitle(title, t)) return true;
  return false;
}
