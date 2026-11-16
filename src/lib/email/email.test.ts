import { afterEach, describe, expect, it, vi } from "vitest";
import { readEmailConfig } from "./config";
import { sendBatch } from "./resend";
import { newToken, normalizeEmail, unsubscribeLink } from "./subscribers";
import { buildDigestEmail, escapeHtml } from "./template";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const good = { RESEND_API_KEY: "re_x", RESEND_FROM: "브리프 <noreply@example.com>", SITE_URL: "https://brief.example.com/" };

describe("readEmailConfig", () => {
  it("세 값이 있으면 읽고 주소 끝의 /는 뗀다", () => {
    expect(readEmailConfig(env(good))).toEqual({
      apiKey: "re_x",
      from: "브리프 <noreply@example.com>",
      siteUrl: "https://brief.example.com",
    });
  });
  it("하나라도 없거나 SITE_URL 형식이 틀리면 null", () => {
    expect(readEmailConfig(env({ ...good, RESEND_API_KEY: "" }))).toBeNull();
    expect(readEmailConfig(env({ ...good, SITE_URL: "brief.example.com" }))).toBeNull();
    expect(readEmailConfig(env({ ...good, SITE_URL: "https://brief.example.com/path" }))).toBeNull();
    expect(readEmailConfig(env({}))).toBeNull();
  });
  it("보내는 주소에 줄바꿈이 있으면 거부(헤더 주입 방지)", () => {
    expect(readEmailConfig(env({ ...good, RESEND_FROM: "a@b.co\r\nBcc: x@y.z" }))).toBeNull();
  });
});

describe("template", () => {
  const counts = {
    news: 2,
    housing: 1,
    topTitle: "<b>제목</b>",
    headlines: [
      { title: "<b>제목</b> & 더", url: "https://news.example.com/a?x=1&y=2" },
      { title: "위험한 링크", url: "javascript:alert(1)" },
    ],
  };
  const mail = buildDigestEmail(counts, "https://brief.example.com", "https://brief.example.com/email/unsubscribe?token=t");

  it("제목과 본문에 개수를 담는다", () => {
    expect(mail.subject).toBe("[브리프] 오늘의 새 소식 - 뉴스 2개, 청약 공고 1개");
    expect(mail.text).toContain("뉴스 2개, 청약 공고 1개가 새로 올라왔어요.");
  });
  it("HTML은 이스케이프하고 http(s) 아닌 링크는 걸지 않는다", () => {
    expect(mail.html).not.toContain("<b>제목</b>");
    expect(mail.html).toContain("&lt;b&gt;제목&lt;/b&gt; &amp; 더");
    expect(mail.html).not.toContain("javascript:");
    expect(mail.text).not.toContain("javascript:");
  });
  it("수신 해제 주소가 들어 있고 판단 표현이 없다", () => {
    expect(mail.html).toContain("email/unsubscribe?token=t");
    expect(mail.text).toContain("email/unsubscribe?token=t");
    expect(mail.text + mail.html).not.toMatch(/추천|유망|시세 차익/);
  });
  it("escapeHtml", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  });
});

describe("subscribers helpers", () => {
  it("주소는 소문자·공백 제거", () => expect(normalizeEmail("  Foo@Example.COM ")).toBe("foo@example.com"));
  it("토큰은 매번 다르고 충분히 길다", () => {
    const a = newToken();
    expect(a.length).toBeGreaterThanOrEqual(30);
    expect(a).not.toBe(newToken());
  });
  it("수신 해제 링크", () => {
    expect(unsubscribeLink("https://b.example.com", "a/b")).toBe("https://b.example.com/email/unsubscribe?token=a%2Fb");
  });
});

describe("sendBatch", () => {
  afterEach(() => vi.unstubAllGlobals());
  const config = { apiKey: "re_secret", from: "a@b.co", siteUrl: "https://b.example.com" };
  const mail = (to: string) => ({ to, subject: "s", html: "<p>h</p>", text: "t", unsubscribeUrl: "https://b.example.com/u" });

  it("Resend 일괄 발송 API에 받는 사람마다 한 통씩, 해제 헤더와 함께 보낸다", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendBatch(config, [mail("x@y.co"), mail("z@y.co")]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails/batch");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_secret");
    const body = JSON.parse(init.body as string);
    expect(body).toHaveLength(2);
    expect(body[0].to).toEqual(["x@y.co"]);
    expect(body[0].headers["List-Unsubscribe"]).toBe("<https://b.example.com/u>");
  });
  it("100통을 넘으면 나눠서 보낸다", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendBatch(config, Array.from({ length: 101 }, (_, i) => mail(`u${i}@y.co`)));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("실패하면 상태 코드만 담아 던지고 키와 주소는 메시지에 넣지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"to":"x@y.co"}', { status: 403 })));
    const err = await sendBatch(config, [mail("x@y.co")]).catch((e: Error) => e);
    expect((err as Error).message).toBe("Resend 발송 실패 (403)");
    expect((err as Error).message).not.toContain("re_secret");
  });
});
