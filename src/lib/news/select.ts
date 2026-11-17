import { normalizeTitle, titleSimilarity } from "./dedupe";

/**
 * 한 번에 다 처리하지 못할 만큼 새 기사가 많을 때, "카테고리별 핫 토픽 순"으로 고른다.
 * - 핫함: 같은 이야기를 얼마나 많은 매체가 다뤘는가(제목이 비슷한 기사 수).
 * - 카테고리: 카테고리마다 돌아가며(1위끼리, 2위끼리 …) 채워서 한 분야로 쏠리지 않게 한다.
 * 모두 순수 함수라서 네트워크 없이 테스트한다.
 */

/** 같은 사건을 다룬 기사로 보는 제목 유사도(중복 기준 0.7보다 느슨하다: 매체마다 제목을 다르게 쓴다). */
export const HOT_SIMILARITY = 0.45;
const MIN_TITLE_LEN = 8; // 너무 짧은 제목은 우연히 비슷해지기 쉬워 정확히 같을 때만

export function isRelatedTitle(a: string, b: string): boolean {
  const s = titleSimilarity(a, b);
  if (s === 1) return true;
  if (normalizeTitle(a).length < MIN_TITLE_LEN || normalizeTitle(b).length < MIN_TITLE_LEN) return false;
  return s >= HOT_SIMILARITY;
}

export type Pooled = { title: string; sourceId: number };
export type Hotness = { sources: number; mentions: number };

/** `target` 과 같은 이야기를 다룬 기사(자기 자신 포함)가 `pool` 에 몇 건, 몇 개 매체로 있는지. */
export function computeHotness(target: Pooled, pool: readonly Pooled[]): Hotness {
  const sources = new Set<number>([target.sourceId]);
  let mentions = 1; // 자기 자신
  for (const p of pool) {
    if (p === target) continue;
    if (isRelatedTitle(target.title, p.title)) {
      sources.add(p.sourceId);
      mentions++;
    }
  }
  return { sources: sources.size, mentions };
}

export type Selectable = {
  id: number;
  categoryId: number | null;
  sources: number;
  mentions: number;
  /** 발행 시각(밀리초). 없으면 0 */
  time: number;
};

/** 더 핫한 쪽이 앞: 매체 수 → 기사 수 → 최신 → id */
export function byHotness(a: Selectable, b: Selectable): number {
  return b.sources - a.sources || b.mentions - a.mentions || b.time - a.time || a.id - b.id;
}

/**
 * 카테고리 순서(`categoryOrder`)대로 한 분야씩 돌아가며, 각 분야에서 가장 핫한 것부터 `limit`개를 고른다.
 * 분류가 없는(null) 기사는 마지막 분야로 취급한다. 반환값은 고른 순서의 id.
 */
export function selectHotTopics(items: readonly Selectable[], limit: number, categoryOrder: readonly number[]): number[] {
  if (limit <= 0) return [];
  const buckets = new Map<number | null, Selectable[]>();
  for (const it of items) {
    const list = buckets.get(it.categoryId) ?? [];
    list.push(it);
    buckets.set(it.categoryId, list);
  }
  for (const list of buckets.values()) list.sort(byHotness);

  // 분야 순서: 카테고리 순서 → 순서에 없는 카테고리 → 미분류
  const known = categoryOrder.filter((c) => buckets.has(c));
  const unknown = [...buckets.keys()].filter((c): c is number => c !== null && !categoryOrder.includes(c));
  const order: (number | null)[] = [...known, ...unknown, ...(buckets.has(null) ? [null] : [])];

  const picked: number[] = [];
  for (let round = 0; picked.length < limit; round++) {
    let tookAny = false;
    for (const key of order) {
      const it = buckets.get(key)?.[round];
      if (!it) continue;
      picked.push(it.id);
      tookAny = true;
      if (picked.length >= limit) break;
    }
    if (!tookAny) break;
  }
  return picked;
}
