import { describe, it, expect } from "vitest";
import { finishTools, exportMarkdown } from "./transcript";
import type { SessionRecord } from "./protocol";
describe("session recovery and export", () => {
  const record: SessionRecord = {
    sessionId: "test-session",
    title: "测试",
    cwd: "C:/project",
    updatedAt: "2026-09-15",
    plan: [],
    blocks: [
      {
        type: "tool",
        tool: {
          toolCallId: "1",
          title: "Edit",
          content: [{ type: "diff", path: "a.txt", oldText: "blue", newText: "green" }],
        },
      },
      { type: "tool", tool: { toolCallId: "2", status: "completed" } },
      { type: "answer", text: "修改完成" },
    ],
  };
  it("marks unfinished tools as interrupted without changing completed work", () => {
    const result = finishTools(record);
    expect(result.blocks[0]).toMatchObject({ tool: { status: "interrupted" } });
    expect(result.blocks[1]).toMatchObject({ tool: { status: "completed" } });
    expect(record.blocks[0]).not.toHaveProperty("tool.status");
  });
  it("exports a readable report containing both sides of changes", () => {
    const result = exportMarkdown(record);
    expect(result).toContain("修改前：");
    expect(result).toContain("blue");
    expect(result).toContain("green");
    expect(result).toContain("修改完成");
  });
  it("includes native Grok output in exported conversations", () => {
    expect(
      exportMarkdown({
        ...record,
        blocks: [
          {
            type: "tool",
            tool: {
              toolCallId: "command",
              rawOutput: { output: [50, 48, 51] },
              status: "completed",
            },
          },
        ],
      }),
    ).toContain("203");
  });
});
