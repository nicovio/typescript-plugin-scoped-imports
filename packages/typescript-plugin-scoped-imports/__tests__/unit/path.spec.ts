import path from "node:path";

import {
  normalizePath,
  toDirectoryPath,
  toPosixAbsolute,
} from "../../src/utils/path";

describe("path utils", () => {
  test("normalizePath converts windows separators", () => {
    expect(normalizePath("a\\b\\c")).toBe("a/b/c");
  });

  test("toDirectoryPath appends slash once", () => {
    expect(toDirectoryPath("a/b")).toBe("a/b/");
    expect(toDirectoryPath("a/b/")).toBe("a/b/");
  });

  test("toPosixAbsolute returns normalized absolute path", () => {
    const absolute = toPosixAbsolute(path.join(".", "src", "index.ts"));
    expect(absolute.startsWith("/")).toBe(true);
    expect(absolute.includes("\\")).toBe(false);
  });
});
