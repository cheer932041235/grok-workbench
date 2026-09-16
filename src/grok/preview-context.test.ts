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

it("extracts quoted shell paths and session output locations without trailing quotes", () => {
  const session = String.raw`C:\Users\demo\.grok\sessions\E%3A%5Cstudy\session-one`;
  const context = previewContext([
    {
      type: "tool",
      tool: {
        toolCallId: "copy",
        rawInput: { command: `$session = '${session}'\n$dest = Join-Path $session 'videos'` },
        rawOutput: { output_file: session + String.raw`\terminal\copy.log` },
      },
    },
  ]);
  expect(context.paths).toContain(session);
  expect(context.paths).toContain(session + String.raw`\terminal\copy.log`);
  expect(context.paths.some((path) => path.endsWith("'"))).toBe(false);
});
