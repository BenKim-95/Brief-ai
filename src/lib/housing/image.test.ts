import { describe, expect, it } from "vitest";
import { enlargeThumbnail, imageQueries, isWantedImage, nameTokens, pickThumbnail } from "./image";

const ok = { title: "래미안 <b>조감도</b>", thumbnail: "https://b/y.jpg", sizewidth: "1200", sizeheight: "800" };

describe("housing image", () => {
  it("builds queries from the complex name", () => {
    expect(imageQueries(" 래미안 원펜타스(1차) 1블록 ")).toEqual(["래미안 원펜타스 1블록 조감도", "래미안 원펜타스 1블록"]);
  });
  it("accepts a landscape rendering photo", () => {
    expect(isWantedImage(ok, "래미안")).toBe(true);
  });
  it("rejects ads, notices and news headlines", () => {
    expect(isWantedImage({ ...ok, title: "래미안 조감도 분양 상담 문의" }, "래미안")).toBe(false);
    expect(isWantedImage({ ...ok, title: "래미안 1순위 청약 경쟁률" }, "래미안")).toBe(false);
    expect(isWantedImage({ ...ok, title: "래미안 평면도" }, "래미안")).toBe(false);
  });
  it("requires the complex name in the title", () => {
    expect(isWantedImage({ ...ok, title: "자이 조감도" }, "래미안 원펜타스")).toBe(false);
    expect(isWantedImage({ ...ok, title: "래미안원펜타스 조감도" }, "래미안 원펜타스")).toBe(true);
    expect(nameTokens("봉담자이 프라이드시티(공공분양) 1블록")).toEqual(["봉담자이", "프라이드시티"]);
    expect(nameTokens("샘플 푸르지오 파크")).toEqual([]);
  });
  it("rejects titles that do not say it is the building", () => {
    expect(isWantedImage({ ...ok, title: "래미안 이야기" }, "래미안")).toBe(false);
  });
  it("accepts press and review photos by host when the title has the name", () => {
    const press = { ...ok, title: "래미안 414세대 공급", link: "http://imgnews.naver.net/a.jpg" };
    expect(isWantedImage(press, "래미안")).toBe(true);
    expect(isWantedImage({ ...press, link: "https://pup-post-phinf.pstatic.net/a.jpg" }, "래미안")).toBe(false);
    expect(isWantedImage({ ...press, title: "[카드] 래미안 공급" }, "래미안")).toBe(false);
  });
  it("rejects banners, portraits and tiny images", () => {
    expect(isWantedImage({ ...ok, sizewidth: "960", sizeheight: "399" }, "래미안")).toBe(false);
    expect(isWantedImage({ ...ok, sizewidth: "500", sizeheight: "666" }, "래미안")).toBe(false);
    expect(isWantedImage({ ...ok, sizewidth: "300", sizeheight: "200" }, "래미안")).toBe(false);
  });
  it("takes the first wanted https thumbnail, enlarged", () => {
    expect(
      pickThumbnail([
        { ...ok, title: "광고 조감도" },
        { ...ok, thumbnail: "http://a/x.jpg" },
        { ...ok, thumbnail: "https://search.pstatic.net/sunny/?type=b150&src=x" },
      ], "래미안"),
    ).toBe("https://search.pstatic.net/sunny/?type=b360&src=x");
  });
  it("returns null when nothing usable", () => {
    expect(pickThumbnail([], "래미안")).toBeNull();
    expect(pickThumbnail(undefined, "래미안")).toBeNull();
  });
  it("asks for the 360px version of Naver thumbnails", () => {
    expect(enlargeThumbnail("https://search.pstatic.net/sunny/?type=b150&src=x")).toBe(
      "https://search.pstatic.net/sunny/?type=b360&src=x",
    );
  });
});
