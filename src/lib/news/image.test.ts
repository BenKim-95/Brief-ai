import { describe, expect, it } from "vitest";
import { isBlockedHost, parseOgImage, pickImageUrl, safeImageUrl } from "./image";

describe("safeImageUrl", () => {
  it("https만 통과시키고 나머지는 버린다", () => {
    expect(safeImageUrl("https://a.com/x.jpg")).toBe("https://a.com/x.jpg");
    expect(safeImageUrl("http://a.com/x.jpg")).toBeNull();
    expect(safeImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeImageUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(safeImageUrl("")).toBeNull();
    expect(safeImageUrl(undefined)).toBeNull();
    expect(safeImageUrl(`https://a.com/${"x".repeat(1100)}`)).toBeNull();
  });
  it("사이트 로고·기본 이미지는 기사 사진이 아니라서 버린다", () => {
    expect(safeImageUrl("https://r.yna.co.kr/global/home/v01/img/yonhapnews_logo_1200x800_kr01.jpg")).toBeNull();
    expect(safeImageUrl("https://a.com/images/logo.png")).toBeNull();
    expect(safeImageUrl("https://a.com/common/no-image.png")).toBeNull();
    expect(safeImageUrl("https://a.com/default_img.jpg")).toBeNull();
    // 실제 기사 사진은 통과
    expect(safeImageUrl("https://img.yna.co.kr/photo/yna/YH/2026/11/13/PYH2026111315140005400_P2.jpg")).not.toBeNull();
    expect(safeImageUrl("https://a.com/photo/technology_news.jpg")).not.toBeNull();
  });
  it("상대 주소는 기준 주소로 풀고 &amp; 를 되돌린다", () => {
    expect(safeImageUrl("/img/a.jpg", "https://news.example/view/1")).toBe("https://news.example/img/a.jpg");
    expect(safeImageUrl("https://a.com/x.jpg?a=1&amp;b=2")).toBe("https://a.com/x.jpg?a=1&b=2");
  });
});

describe("pickImageUrl", () => {
  it("media:content 의 이미지를 고른다 (동영상은 건너뜀)", () => {
    expect(
      pickImageUrl({
        mediaContent: [{ $: { url: "https://a.com/v.mp4", type: "video/mp4" } }, { $: { url: "https://a.com/p.jpg", type: "image/jpeg" } }],
      }),
    ).toBe("https://a.com/p.jpg");
  });
  it("타입이 없어도 확장자가 이미지면 쓴다", () => {
    expect(pickImageUrl({ mediaContent: [{ $: { url: "https://a.com/p.webp" } }] })).toBe("https://a.com/p.webp");
  });
  it("media:thumbnail, enclosure, 본문 <img> 순으로 대체한다", () => {
    expect(pickImageUrl({ mediaThumbnail: [{ $: { url: "https://a.com/t.jpg" } }] })).toBe("https://a.com/t.jpg");
    expect(pickImageUrl({ enclosure: { url: "https://a.com/e.png", type: "image/png" } })).toBe("https://a.com/e.png");
    expect(pickImageUrl({ enclosure: { url: "https://a.com/e.mp3", type: "audio/mpeg" } })).toBeNull();
    expect(pickImageUrl({ content: '<p>글</p><img src="https://a.com/c.jpg" width="1">' })).toBe("https://a.com/c.jpg");
  });
  it("이미지가 없으면 null", () => {
    expect(pickImageUrl({})).toBeNull();
    expect(pickImageUrl({ content: "<p>글만 있어요</p>" })).toBeNull();
  });
});

describe("parseOgImage", () => {
  it("속성 순서와 따옴표가 달라도 og:image 를 찾는다", () => {
    expect(parseOgImage('<meta property="og:image" content="https://a.com/o.jpg" />', "https://a.com/v")).toBe("https://a.com/o.jpg");
    expect(parseOgImage("<meta content='https://a.com/o2.jpg' property='og:image'>", "https://a.com/v")).toBe("https://a.com/o2.jpg");
  });
  it("상대 주소를 풀고 twitter:image 로 대체한다", () => {
    expect(parseOgImage('<meta property="og:image" content="/o.jpg">', "https://a.com/v/1")).toBe("https://a.com/o.jpg");
    expect(parseOgImage('<meta name="twitter:image" content="https://a.com/t.jpg">', "https://a.com/v")).toBe("https://a.com/t.jpg");
  });
  it("없거나 안전하지 않으면 null", () => {
    expect(parseOgImage("<html><head><title>x</title></head>", "https://a.com")).toBeNull();
    expect(parseOgImage('<meta property="og:image" content="http://a.com/o.jpg">', "https://a.com")).toBeNull();
  });
});

describe("isBlockedHost", () => {
  it("내부망·로컬 주소는 막고 일반 도메인은 허용한다", () => {
    for (const h of ["localhost", "127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "169.254.169.254", "[::1]", "printer.local"]) {
      expect(isBlockedHost(h)).toBe(true);
    }
    for (const h of ["www.yna.co.kr", "8.8.8.8", "172.32.0.1"]) expect(isBlockedHost(h)).toBe(false);
  });
});
