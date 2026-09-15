import { describe, expect, it } from "vitest";
import { parseFileLink } from "./file-links";
describe("local file links", () => {
  it("parses Windows, encoded spaces, Chinese names and line anchors", () => {
    expect(parseFileLink("C:/项目/示例%20文件.ts:42:3")).toEqual({
      path: "C:/项目/示例 文件.ts",
      line: 42,
    });
    expect(parseFileLink("src/main.rs#L12-L18")).toEqual({ path: "src/main.rs", line: 12 });
    expect(parseFileLink("file:///C:/notes/demo.md#L7")).toEqual({
      path: "C:/notes/demo.md",
      line: 7,
    });
    expect(parseFileLink("demo.ts:42")).toEqual({ path: "demo.ts", line: 42 });
    expect(parseFileLink("README.md#usage")).toEqual({ path: "README.md" });
    expect(parseFileLink("notes%23one.md")).toEqual({ path: "notes#one.md" });
    expect(parseFileLink("../说明.md")).toEqual({ path: "../说明.md" });
  });
  it("leaves websites and anchors alone and rejects nonlocal protocols", () => {
    for (const href of [
      "https://example.com/doc.md",
      "#heading",
      "javascript:alert(1)",
      "data:text/html,test",
      "file://server/share/x",
      "//server/x",
      "cmd:run",
    ])
      expect(parseFileLink(href)).toBeUndefined();
  });
});
