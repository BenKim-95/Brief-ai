import { describe, expect, it } from "vitest";
import {
  categoryCreateSchema,
  categoryReorderSchema,
  sourceCreateSchema,
  sourceUpdateSchema,
} from "./schemas";

describe("sourceCreateSchema", () => {
  it("applies defaults and trims", () => {
    const r = sourceCreateSchema.parse({
      name: "  TechCrunch ",
      url: "https://techcrunch.com/feed/",
    });
    expect(r).toMatchObject({ name: "TechCrunch", language: "en", active: true });
  });

  it("rejects non-http urls and empty names", () => {
    expect(sourceCreateSchema.safeParse({ name: "a", url: "ftp://x.com/f" }).success).toBe(false);
    expect(sourceCreateSchema.safeParse({ name: " ", url: "https://x.com" }).success).toBe(false);
  });
});

describe("sourceUpdateSchema", () => {
  it("does not inject defaults into partial updates", () => {
    expect(sourceUpdateSchema.parse({ active: false })).toEqual({ active: false });
  });
});

describe("category schemas", () => {
  it("defaults description to empty", () => {
    expect(categoryCreateSchema.parse({ name: "모델/연구" }).description).toBe("");
  });

  it("requires at least one id for reorder", () => {
    expect(categoryReorderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(categoryReorderSchema.safeParse({ ids: [2, 1] }).success).toBe(true);
  });
});
