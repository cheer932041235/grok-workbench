import { it, expect } from "vitest";
import { visibleBlock } from "./display-policy";
import { applySessionEvent } from "./session-events";
import { materializeHistory } from "./history";
import { exportMarkdown } from "./transcript";
import type { Transcript } from "./protocol";
it("keeps failures and interruptions visible in answer-only mode", () => {
  for (const status of ["failed", "interrupted"])
    expect(visibleBlock({ type: "tool", tool: { toolCallId: "a", status } }, "answers")).toBe(true);
  expect(
    visibleBlock({ type: "tool", tool: { toolCallId: "a", status: "completed" } }, "answers"),
  ).toBe(false);
  for (const filter of ["all", "answers", "tools"])
    expect(visibleBlock({ type: "thought", text: "thinking" }, filter)).toBe(true);
});
it("uses actual timestamps, does not invent elapsed time, and retains it on later deltas", () => {
  let t: Transcript = { blocks: [], plan: [] };
  const event = (text: string, meta?: Record<string, unknown>) => ({
    method: "session/update",
    params: {
      sessionId: "r",
      update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text } },
      _meta: meta,
    },
  });
  t = applySessionEvent(t, "r", event("a"));
  expect(t.blocks[0]).not.toHaveProperty("durationMs");
  t = applySessionEvent(t, "r", event("b", { agentTimestampMs: 4500, streamStartMs: 1000 }));
  expect(t.blocks[0]).toMatchObject({ text: "ab", durationMs: 3500 });
  t = applySessionEvent(t, "r", event("c"));
  expect(t.blocks[0]).toMatchObject({ text: "abc", durationMs: 3500 });
});
it("persists background snapshots, hook failures and interaction history through import and export", () => {
  let t: Transcript = {
    blocks: [],
    plan: [{ content: "Read", status: "completed", priority: "medium" }],
    activity: [{ label: "已回答问题", detail: "choice A" }],
  };
  const event = (update: Record<string, unknown>) => ({
    method: "_x.ai/session_notification",
    params: { sessionId: "r", update },
  });
  t = applySessionEvent(
    t,
    "r",
    event({ sessionUpdate: "hook_execution", runs: [{ status: { status: "failed" } }] }),
  );
  expect(t.activity?.[1].failed).toBe(true);
  t = applySessionEvent(
    t,
    "r",
    event({ sessionUpdate: "background_tasks", tasks: [{ name: "Task A" }] }),
  );
  expect(t.backgroundTasks).toHaveLength(1);
  const r = materializeHistory(
    JSON.parse(
      JSON.stringify({
        ...t,
        sessionId: "r",
        cwd: "fixture",
        title: "test",
        updatedAt: "now",
        importedEvents: [],
      }),
    ),
  );
  expect(r.activity).toEqual(t.activity);
  expect(exportMarkdown(r)).toContain("choice A");
  expect(exportMarkdown(r)).toContain("Task A");
  expect(exportMarkdown(r)).toContain("Read");
  t = applySessionEvent(t, "r", event({ sessionUpdate: "background_tasks", tasks: [] }));
  expect(t.backgroundTasks).toEqual([]);
});
