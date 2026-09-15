import { describe, it, expect } from "vitest";
import { questionResponse } from "./interactions";
import { toolText } from "./protocol";

describe("Grok native interactions", () => {
  it("preserves question keys, multiple labels, previews and freeform notes", () => {
    expect(
      questionResponse(
        [
          { question: "格式？", options: [{ label: "表格", description: "", preview: "| A |" }] },
          { question: "内容？", options: [], multiSelect: true },
          { question: "补充？", options: [] },
        ],
        [["表格"], ["结果", "方法"], []],
        ["", "", "中文"],
      ),
    ).toEqual({
      outcome: "accepted",
      answers: { "格式？": ["表格"], "内容？": ["结果", "方法"], "补充？": ["Other"] },
      annotations: { "格式？": { preview: "| A |" }, "补充？": { notes: "中文" } },
    });
  });
  it("does not invent answers to unanswered questions", () => {
    expect(questionResponse([{ question: "规模？", options: [] }], [], [])).toEqual({
      outcome: "accepted",
      answers: {},
    });
  });
  it("renders native command UTF-8 byte output and stderr", () => {
    expect(
      toolText({
        toolCallId: "cmd",
        rawOutput: { output: [...new TextEncoder().encode("中文\n")], stderr: [69] },
      }),
    ).toBe("中文\n\nE");
  });
  it("renders native file and directory output while preferring ACP text", () => {
    expect(
      toolText({ toolCallId: "read", rawOutput: { FileContent: { raw_output: "a\nb" } } }),
    ).toBe("a\nb");
    expect(toolText({ toolCallId: "ls", rawOutput: { Content: { content: "folder/" } } })).toBe(
      "folder/",
    );
    expect(
      toolText({
        toolCallId: "cmd",
        content: [{ type: "text", text: "formatted" }],
        rawOutput: { output: [65] },
      }),
    ).toBe("formatted");
  });
});
