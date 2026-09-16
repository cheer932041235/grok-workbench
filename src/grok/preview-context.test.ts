import { expect, it } from "vitest";
import { previewContext } from "./preview-context";
it("collects conversation paths, skill names and tool paths", () => {
  const context = previewContext([
    { type: "answer", text: "修改 talking-head-local；文件 `C:/研究/论文/main.pdf`" },
    { type: "tool", tool: { toolCallId: "1", rawInput: { path: "D:/项目/demo/readme.md" } } },
  ]);
  expect(context.paths).toEqual(["C:/研究/论文/main.pdf", "D:/项目/demo/readme.md"]);
  expect(context.skills).toContain("talking-head-local");
});
