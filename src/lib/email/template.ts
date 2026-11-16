import type { DigestCounts } from "@/lib/push/digest";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** 원문 링크는 http(s)만 허용한다(javascript: 등 차단). */
function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

/**
 * 요약 메일. 개수와 최신 제목(원문 링크)만 담고, 본문 전체는 싣지 않는다.
 * 추천·전망 표현 없이 사실만 전한다.
 */
export function buildDigestEmail(counts: DigestCounts, siteUrl: string, unsubscribeUrl: string) {
  const parts: string[] = [];
  if (counts.news > 0) parts.push(`뉴스 ${counts.news}개`);
  if (counts.housing > 0) parts.push(`청약 공고 ${counts.housing}개`);
  const summary = `${parts.join(", ")}가 새로 올라왔어요.`;
  const subject = `[브리프] 오늘의 새 소식 - ${parts.join(", ")}`;

  const lines = counts.headlines.map((h) => ({ title: h.title, href: safeHref(h.url) }));
  const text = [
    summary,
    "",
    ...lines.map((l) => `- ${l.title}${l.href ? `\n  ${l.href}` : ""}`),
    "",
    `브리프 열기: ${siteUrl}`,
    "",
    `이 메일을 더 받고 싶지 않다면: ${unsubscribeUrl}`,
  ].join("\n");

  const items = lines
    .map((l) =>
      l.href
        ? `<li style="margin:0 0 8px"><a href="${escapeHtml(l.href)}" style="color:#1d4ed8">${escapeHtml(l.title)}</a></li>`
        : `<li style="margin:0 0 8px">${escapeHtml(l.title)}</li>`,
    )
    .join("");
  const html = `<!doctype html><html lang="ko"><body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:16px;color:#111">
<h1 style="font-size:20px;margin:0 0 12px">오늘의 새 소식</h1>
<p style="margin:0 0 16px">${escapeHtml(summary)}</p>
${items ? `<ul style="padding-left:18px;margin:0 0 16px">${items}</ul>` : ""}
<p style="margin:0 0 24px"><a href="${escapeHtml(siteUrl)}" style="color:#1d4ed8">브리프에서 전체 보기</a></p>
<p style="font-size:12px;color:#666;margin:0">이 메일을 더 받고 싶지 않다면 <a href="${escapeHtml(unsubscribeUrl)}" style="color:#666">여기에서 수신을 해제</a>해 주세요.</p>
</body></html>`;
  return { subject, html, text };
}
