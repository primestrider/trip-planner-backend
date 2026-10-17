import { BadRequestException } from "@nestjs/common";
import { parseIfMatch } from "./if-match";

describe("parseIfMatch", () => {
  it.each([
    ["3", 3],
    ['"3"', 3],
    ['W/"12"', 12],
    [" 7 ", 7]
  ])("should read %s as version %d", (header, version) => {
    expect(parseIfMatch(header)).toBe(version);
  });

  it.each([undefined, "", "  "])(
    "should mean no version check for %p",
    (header) => {
      expect(parseIfMatch(header)).toBeUndefined();
    }
  );

  it.each(["*", "abc", '"1", "2"', "-1", "1.5"])(
    "should reject %s",
    (header) => {
      expect(() => parseIfMatch(header)).toThrow(BadRequestException);
    }
  );
});
