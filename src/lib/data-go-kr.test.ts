import { afterEach, describe, expect, it } from "vitest";
import { getDataGoKrServiceKey } from "./data-go-kr";

describe("getDataGoKrServiceKey", () => {
  afterEach(() => {
    delete process.env.DATA_GO_KR_SERVICE_KEY;
  });

  it("returns 503 when the key is unset or blank", () => {
    process.env.DATA_GO_KR_SERVICE_KEY = "  ";
    const result = getDataGoKrServiceKey();
    expect("error" in result && result.error.status).toBe(503);
  });

  it("returns the trimmed key", () => {
    process.env.DATA_GO_KR_SERVICE_KEY = " abc+/= ";
    expect(getDataGoKrServiceKey()).toEqual({ key: "abc+/=" });
  });
});
