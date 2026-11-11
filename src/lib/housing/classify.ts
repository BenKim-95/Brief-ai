export type ClassifyCategory = { id: number; keywords: string[] };

/**
 * Categories must already be in display order (sort_order, id). The first one
 * with a keyword contained in "<feed name> <type label>" wins; case-insensitive.
 */
export function classifyNotice(
  categories: ClassifyCategory[],
  feedName: string | null,
  typeLabel: string,
): number | null {
  const text = `${feedName ?? ""} ${typeLabel}`.toLowerCase();
  for (const c of categories) {
    if (
      c.keywords.some((k) => {
        const kw = k.trim().toLowerCase();
        return kw.length > 0 && text.includes(kw);
      })
    )
      return c.id;
  }
  return null;
}

/** Comma/newline separated input → trimmed, unique, non-empty keywords. */
export function parseKeywords(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,\n]/)
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  ];
}
