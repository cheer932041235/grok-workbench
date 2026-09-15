import { expect, it } from "vitest";
import { applySessionEvent, restoreSubagents } from "./session-events";
import { applyUpdate, type Transcript } from "./protocol";
import { exportMarkdown } from "./transcript";

const event = (
  sessionId: string,
  update: Record<string, unknown>,
  method = "_x.ai/session_notification",
) => ({ method, params: { sessionId, update } });
const spawn = event("root", {
  sessionUpdate: "subagent_spawned",
  child_session_id: "child",
  subagent_id: "child",
  parent_session_id: "root",
  subagent_type: "explore",
  description: "检查历史记录",
});

it("routes child text and tools separately and ignores unrelated sessions", () => {
  let state: Transcript = { blocks: [], plan: [] };
  state = applySessionEvent(state, "root", spawn);
  state = applySessionEvent(
    state,
    "root",
    event(
      "child",
      { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "子任务内容" } },
      "session/update",
    ),
  );
  state = applySessionEvent(
    state,
    "root",
    event(
      "child",
      { sessionUpdate: "tool_call", toolCallId: "shared-id", title: "子工具" },
      "session/update",
    ),
  );
  state = applySessionEvent(
    state,
    "root",
    event(
      "root",
      { sessionUpdate: "tool_call", toolCallId: "shared-id", title: "主工具" },
      "session/update",
    ),
  );
  expect(state.blocks).toHaveLength(1);
  expect(state.subagents?.[0].transcript.blocks).toHaveLength(2);
  expect(
    applySessionEvent(
      state,
      "root",
      event(
        "unrelated",
        { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "其他会话" } },
        "session/update",
      ),
    ),
  ).toBe(state);
});

it("preserves progress, completion and nested children across saved-history restoration", () => {
  let state: Transcript = applySessionEvent({ blocks: [], plan: [] }, "root", spawn);
  state = applySessionEvent(
    state,
    "root",
    event("root", {
      sessionUpdate: "subagent_progress",
      child_session_id: "child",
      tool_call_count: 3,
      turn_count: 2,
    }),
  );
  state = applySessionEvent(
    state,
    "root",
    event("child", {
      sessionUpdate: "subagent_spawned",
      child_session_id: "grandchild",
      description: "检查公式",
      subagent_type: "plan",
    }),
  );
  state = applySessionEvent(
    state,
    "root",
    event("root", {
      sessionUpdate: "subagent_finished",
      child_session_id: "child",
      status: "completed",
      output: "检查完成",
    }),
  );
  const restored = restoreSubagents(JSON.parse(JSON.stringify(state)));
  expect(restored.subagents?.[0]).toMatchObject({
    status: "completed",
    output: "检查完成",
    toolCalls: 3,
    turns: 2,
  });
  expect(restored.subagents?.[1]).toMatchObject({ parentId: "child", status: "unknown" });
  expect(
    exportMarkdown({
      ...restored,
      sessionId: "root",
      title: "主会话",
      cwd: "project",
      updatedAt: "today",
    }),
  ).toContain("检查完成");
});

it("text patches preserve user images", () => {
  const images = [{ name: "image.png", data: "aGVsbG8=", mimeType: "image/png" }];
  const state = applyUpdate(
    { blocks: [{ type: "user", text: "说明", images }], plan: [] },
    { sessionUpdate: "user_message_chunk", content: { type: "text", text: "补充" } },
  );
  expect(state.blocks[0]).toEqual({ type: "user", text: "说明补充", images });
});
