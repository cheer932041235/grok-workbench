import { expect, it } from "vitest";
import { promptText, remoteCommand, slashCommand } from "./commands";
import { applySessionEvent } from "./session-events";
import { materializeHistory } from "./history";
import { exportMarkdown } from "./transcript";
const commands = [
  { name: "goal", description: "goal" },
  { name: "session-info", description: "info" },
  { name: "user:review", description: "skill" },
];
it("keeps slash commands at the start instead of swallowing them in research context", () => {
  for (const text of [
    "/goal 改进实验 --budget 5000",
    "/goal status",
    "/goal pause",
    "/workflow runs",
    "/user:review 中文",
  ]) {
    expect(promptText(text, "研究上下文")).toBe(text);
  }
  expect(promptText("分析这篇文章", "研究上下文")).toContain(
    "研究上下文\n\n## 本轮用户需求\n分析这篇文章",
  );
});
it("uses the live command catalog and preserves qualified skills", () => {
  expect(remoteCommand("/user:review 中文", commands)).toBe("/user:review 中文");
  expect(remoteCommand("/context", commands)).toBe("/session-info");
  expect(() => remoteCommand("/not-supported", commands)).toThrow("未提供");
  expect(remoteCommand("hello", [])).toBe("hello");
});
it("does not treat absolute file paths as slash commands", () => {
  expect(slashCommand("/home/user/paper.pdf")).toBeUndefined();
  expect(slashCommand("/goal status")).toEqual({ name: "goal", args: "status" });
});
it("retains root goal and workflow status through history and export", () => {
  const base = {
    sessionId: "root",
    cwd: "paper",
    title: "test",
    updatedAt: "now",
    blocks: [],
    plan: [],
  };
  const events = [
    {
      method: "_x.ai/session/update",
      params: {
        sessionId: "root",
        update: {
          sessionUpdate: "goal_updated",
          goal_id: "g",
          objective: "实验",
          status: "active",
          phase: "planning",
        },
      },
    },
    {
      method: "_x.ai/session/update",
      params: {
        sessionId: "root",
        update: {
          sessionUpdate: "workflow_updated",
          run_id: "w",
          name: "review",
          status: "running",
        },
      },
    },
  ];
  const saved = materializeHistory({ ...base, importedEvents: events });
  expect(saved.goal?.objective).toBe("实验");
  expect(saved.workflows).toHaveLength(1);
  expect(exportMarkdown(saved)).toContain("实验");
  const next = applySessionEvent(saved, "root", {
    method: "_x.ai/session/update",
    params: {
      sessionId: "root",
      update: { sessionUpdate: "workflow_updated", run_id: "w", status: "complete" },
    },
  });
  expect(next.workflows).toHaveLength(1);
  expect(next.workflows?.[0].status).toBe("complete");
  expect(
    applySessionEvent(saved, "root", {
      method: "_x.ai/session/update",
      params: { sessionId: "other", update: { sessionUpdate: "goal_updated", objective: "wrong" } },
    }),
  ).toBe(saved);
});
