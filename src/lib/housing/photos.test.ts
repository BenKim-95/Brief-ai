import { describe, expect, it } from "vitest";
import { groupByKind, needsPhotoSearch, photoQueries, pickPhotos, toPhoto, type HousingPhoto } from "./photos";

const it1 = (over: Record<string, unknown> = {}) => ({
  title: "<b>래미안 원펜타스</b> 조감도",
  link: "https://img.example.com/a.jpg",
  thumbnail: "https://search.pstatic.net/a.jpg?type=b150",
  sizewidth: "1200",
  sizeheight: "800",
  ...over,
});

describe("photoQueries", () => {
  it("괄호는 빼고 갈래 이름을 붙인다(배치도는 단지배치도로 검색)", () => {
    expect(photoQueries("래미안 원펜타스 (1블록)", "평면도")).toBe("래미안 원펜타스 평면도");
    expect(photoQueries("래미안 원펜타스", "배치도")).toBe("래미안 원펜타스 단지배치도");
  });
});

describe("toPhoto", () => {
  it("이름과 갈래 말이 제목에 있으면 사진으로 받고, 썸네일을 큰 판으로 바꾼다", () => {
    const p = toPhoto(it1(), "래미안 원펜타스", "조감도");
    expect(p).toMatchObject({ kind: "조감도", thumb: "https://search.pstatic.net/a.jpg?type=b360", link: "https://img.example.com/a.jpg", title: "래미안 원펜타스 조감도" });
  });
  it("평면도는 세로로 긴 사진도 받는다(조감도 전용 비율 제한이 없다)", () => {
    const p = toPhoto(it1({ title: "래미안 원펜타스 84A 평면도", sizewidth: "600", sizeheight: "900" }), "래미안 원펜타스", "평면도");
    expect(p?.kind).toBe("평면도");
  });
  it("다른 단지 사진, 갈래가 다른 제목, 광고성 제목은 거른다", () => {
    expect(toPhoto(it1({ title: "자이 조감도" }), "래미안 원펜타스", "조감도")).toBeNull();
    expect(toPhoto(it1({ title: "래미안 원펜타스 외관" }), "래미안 원펜타스", "평면도")).toBeNull();
    expect(toPhoto(it1({ title: "래미안 원펜타스 조감도 분양 상담 문의" }), "래미안 원펜타스", "조감도")).toBeNull();
    expect(toPhoto(it1({ title: "래미안 원펜타스 조감도 시세" }), "래미안 원펜타스", "조감도")).toBeNull();
  });
  it("https 썸네일이 없거나 너무 작은 사진, 이름을 알 수 없는 단지는 거른다", () => {
    expect(toPhoto(it1({ thumbnail: "http://x/a.jpg" }), "래미안 원펜타스", "조감도")).toBeNull();
    expect(toPhoto(it1({ link: "javascript:alert(1)" }), "래미안 원펜타스", "조감도")).toBeNull();
    expect(toPhoto(it1({ sizewidth: "100", sizeheight: "80" }), "래미안 원펜타스", "조감도")).toBeNull();
    expect(toPhoto(it1(), "샘플 푸르지오", "조감도")).toBeNull();
  });
});

describe("pickPhotos", () => {
  it("같은 사진은 한 번만, 갈래마다 6장까지", () => {
    const many = Array.from({ length: 10 }, (_, i) => it1({ thumbnail: `https://search.pstatic.net/${i}.jpg?type=b150` }));
    const out = pickPhotos([...many, many[0]], "래미안 원펜타스", "조감도");
    expect(out).toHaveLength(6);
    expect(new Set(out.map((p) => p.thumb)).size).toBe(6);
  });
  it("배열이 아니면 빈 목록", () => {
    expect(pickPhotos(undefined, "래미안", "조감도")).toEqual([]);
  });
});

describe("needsPhotoSearch", () => {
  const now = new Date("2026-11-20T00:00:00Z");
  const photo: HousingPhoto = { kind: "조감도", thumb: "https://a", link: "https://b", title: "t" };
  it("한 번도 안 찾았으면 찾는다", () => expect(needsPhotoSearch(null, now)).toBe(true));
  it("사진이 있으면 다시 찾지 않는다", () => expect(needsPhotoSearch({ checkedAt: "2026-01-01T00:00:00Z", items: [photo] }, now)).toBe(false));
  it("비어 있으면 일주일 뒤에 다시 찾는다", () => {
    expect(needsPhotoSearch({ checkedAt: "2026-11-18T00:00:00Z", items: [] }, now)).toBe(false);
    expect(needsPhotoSearch({ checkedAt: "2026-11-10T00:00:00Z", items: [] }, now)).toBe(true);
  });
});

describe("groupByKind", () => {
  it("정해진 순서로 묶고 빈 갈래는 뺀다", () => {
    const mk = (kind: HousingPhoto["kind"]): HousingPhoto => ({ kind, thumb: `https://${kind}`, link: "https://l", title: "t" });
    expect(groupByKind([mk("평면도"), mk("조감도"), mk("평면도")]).map((g) => [g.kind, g.photos.length])).toEqual([["조감도", 1], ["평면도", 2]]);
  });
});
