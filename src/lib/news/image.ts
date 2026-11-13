/**
 * 기사 카드에 쓸 대표 이미지 주소를 찾는다. 파일은 저장하지 않고 주소만 쓴다.
 * 1순위: RSS 항목이 직접 주는 이미지 (media:content, media:thumbnail, enclosure, 본문 <img>)
 * 2순위: 기사 페이지의 og:image (RSS에 이미지가 없는 매체용)
 */

const IMAGE_EXT = /\.(?:jpe?g|png|webp|gif|avif)(?:[?#].*)?$/i;
const MAX_URL_LENGTH = 1000;

/** 기사 사진이 아니라 사이트 로고·기본 이미지로 보이는 파일명 (og:image 가 이걸 줄 때가 있다). */
const GENERIC_IMAGE = /(?:^|[/_.-])(?:logo|favicon|noimage|no[_-]image|placeholder|default[_-]?(?:img|image|thumb\w*))(?:[/_.-]|$)/i;

/** https 이미지 주소만 통과시킨다 (http는 https 페이지에서 막히고, data:/javascript: 는 위험). 로고는 제외. */
export function safeImageUrl(raw: unknown, base?: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/&amp;/g, "&");
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  try {
    const u = new URL(trimmed, base);
    if (u.protocol !== "https:") return null;
    if (GENERIC_IMAGE.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

type MediaEntry = { $?: { url?: string; type?: string; medium?: string } };

function fromMedia(list: unknown): string | null {
  if (!Array.isArray(list)) return null;
  for (const entry of list as MediaEntry[]) {
    const a = entry?.$;
    if (!a?.url) continue;
    const looksImage =
      a.medium === "image" || a.type?.startsWith("image/") || (!a.type && !a.medium && IMAGE_EXT.test(a.url));
    if (!looksImage) continue;
    const ok = safeImageUrl(a.url);
    if (ok) return ok;
  }
  return null;
}

export type FeedItemImageSource = {
  enclosure?: { url?: string; type?: string };
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
  content?: string;
  "content:encoded"?: string;
};

export function pickImageUrl(item: FeedItemImageSource): string | null {
  const media = fromMedia(item.mediaContent) ?? fromMedia(item.mediaThumbnail);
  if (media) return media;

  const enc = item.enclosure;
  if (enc?.url && (enc.type?.startsWith("image/") || (!enc.type && IMAGE_EXT.test(enc.url)))) {
    const ok = safeImageUrl(enc.url);
    if (ok) return ok;
  }

  const html = item["content:encoded"] ?? item.content ?? "";
  const m = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  return m ? safeImageUrl(m[1]) : null;
}

/** <meta property="og:image" content="..."> (속성 순서·따옴표 차이를 허용). */
export function parseOgImage(html: string, pageUrl: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (key !== "og:image" && key !== "og:image:url" && key !== "twitter:image") continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
    const ok = safeImageUrl(content, pageUrl);
    if (ok) return ok;
  }
  return null;
}

/** 서버가 내부망 주소를 읽지 않도록 막는다 (RSS 항목의 링크는 외부 입력이다). */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h.includes(":")) return h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd");
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    );
  }
  return false;
}

const OG_TIMEOUT_MS = 4000;
const OG_MAX_BYTES = 200_000;
const OG_MAX_REDIRECTS = 3;

/** 기사 페이지의 앞부분만 읽어 og:image를 찾는다. 실패하면 null (사진 없이 보여주면 된다). */
export async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    let url = articleUrl;
    for (let hop = 0; hop <= OG_MAX_REDIRECTS; hop++) {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol) || isBlockedHost(u.hostname)) return null;
      const res = await fetch(u, {
        redirect: "manual",
        signal: AbortSignal.timeout(OG_TIMEOUT_MS),
        headers: { "user-agent": "Mozilla/5.0 (compatible; BriefBot/1.0)", accept: "text/html" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        url = new URL(loc, u).toString();
        continue;
      }
      if (!res.ok || !res.body) return null;
      if (!(res.headers.get("content-type") ?? "").includes("html")) return null;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      let bytes = 0;
      while (bytes < OG_MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        text += decoder.decode(value, { stream: true });
        const found = parseOgImage(text, u.toString());
        if (found) {
          void reader.cancel();
          return found;
        }
        if (/<\/head>/i.test(text)) break;
      }
      void reader.cancel();
      return parseOgImage(text, u.toString());
    }
    return null;
  } catch {
    return null;
  }
}
