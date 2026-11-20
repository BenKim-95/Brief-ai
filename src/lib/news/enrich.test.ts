import { describe, expect, it } from "vitest";
import { enrichBatch, generateInsights } from "./enrich";

/** 정해 둔 글을 그대로 돌려주는 가짜 Claude. */
const fake = (text: string) =>
  ({
    messages: { create: async () => ({ content: [{ type: "text", text }], stop_reason: "end_turn" }) },
  }) as never;

describe("generateInsights", () => {
  it("해설 3줄을 key별로 돌려주고, 보내지 않은 key는 버린다", async () => {
    const out = await generateInsights(
      fake(
        JSON.stringify([
          { key: 0, oneLineKo: "한 줄", learnedKo: "알게 된 점", perspectiveKo: "다른 시각" },
          { key: 9, oneLineKo: "없는 기사", learnedKo: "x", perspectiveKo: "y" },
        ]),
      ),
      [{ key: 0, titleKo: "제목", summaryKo: "요약" }],
    );
    expect([...out.keys()]).toEqual([0]);
    expect(out.get(0)).toEqual({ oneLineKo: "한 줄", learnedKo: "알게 된 점", perspectiveKo: "다른 시각" });
  });
  it("형식이 틀리면 던져서 그 묶음을 건너뛰게 한다", async () => {
    await expect(
      generateInsights(fake(JSON.stringify([{ key: 0, oneLineKo: "" , learnedKo: "a", perspectiveKo: "b" }])), [
        { key: 0, titleKo: "t", summaryKo: "s" },
      ]),
    ).rejects.toThrow();
    await expect(generateInsights(fake("죄송해요"), [{ key: 0, titleKo: "t", summaryKo: "s" }])).rejects.toThrow();
  });
  it("기사가 없으면 Claude를 부르지 않는다", async () => {
    const client = { messages: { create: async () => { throw new Error("부르면 안 돼요"); } } } as never;
    expect((await generateInsights(client, [])).size).toBe(0);
  });
});

describe("enrichBatch: 해설 3줄은 있어도 없어도 기사 저장을 막지 않는다", () => {
  const raw = [{ key: 0, title: "t", snippet: "", sourceName: "출처" }];
  it("해설이 함께 오면 같이 돌려준다", async () => {
    const [r] = await enrichBatch(
      fake(
        JSON.stringify([
          { key: 0, titleKo: "제목", summaryKo: "요약", categoryId: null, oneLineKo: "한 줄", learnedKo: "점", perspectiveKo: "시각" },
        ]),
      ),
      raw,
      [],
    );
    expect(r).toMatchObject({ oneLineKo: "한 줄", learnedKo: "점", perspectiveKo: "시각" });
  });
  it("해설이 빠졌거나 형식이 틀려도 제목·요약은 그대로 받는다", async () => {
    const [a] = await enrichBatch(fake(JSON.stringify([{ key: 0, titleKo: "제목", summaryKo: "요약", categoryId: null }])), raw, []);
    expect(a.titleKo).toBe("제목");
    expect(a.oneLineKo).toBeUndefined();
    const [b] = await enrichBatch(
      fake(JSON.stringify([{ key: 0, titleKo: "제목", summaryKo: "요약", categoryId: null, oneLineKo: 123 }])),
      raw,
      [],
    );
    expect(b.titleKo).toBe("제목");
    expect(b.oneLineKo).toBeUndefined();
  });
});
