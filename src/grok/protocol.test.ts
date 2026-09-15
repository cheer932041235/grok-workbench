import { describe, it, expect } from "vitest";
import { applyUpdate, toolText, type Transcript } from "./protocol";
describe("Grok ACP display", () => {
  it("keeps thinking separate from answers and joins consecutive chunks", () => {
    let state: Transcript = { blocks: [], plan: [] };
    for (const [sessionUpdate, text] of [
      ["agent_thought_chunk", "想一想"],
      ["agent_message_chunk", "Hello"],
      ["agent_message_chunk", " world"],
    ])
      state = applyUpdate(state, { sessionUpdate, content: { type: "text", text } });
    expect(state.blocks).toEqual([
      { type: "thought", text: "想一想" },
      { type: "answer", text: "Hello world" },
    ]);
  });
  it("retains diff and input when completion only patches status", () => {
    let state: Transcript = { blocks: [], plan: [] };
    state = applyUpdate(state, {
      sessionUpdate: "tool_call",
      toolCallId: "edit-1",
      title: "Edit file",
      rawInput: { path: "a.ts" },
      content: [{ type: "diff", path: "a.ts", oldText: "a", newText: "b" }],
    });
    state = applyUpdate(state, {
      sessionUpdate: "tool_call_update",
      toolCallId: "edit-1",
      status: "completed",
    });
    expect(state.blocks).toHaveLength(1);
    const block = state.blocks[0];
    if (block.type !== "tool") throw Error("expected tool");
    expect(block.tool.status).toBe("completed");
    expect(block.tool.content?.[0].newText).toBe("b");
    expect(block.tool.rawInput).toEqual({ path: "a.ts" });
  });
  it("displays wrapped ACP tool output", () => {
    expect(
      toolText({
        toolCallId: "1",
        content: [{ type: "content", content: { type: "text", text: "test passed" } }],
      }),
    ).toBe("test passed");
  });
});
