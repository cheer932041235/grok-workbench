import { expect, it, vi } from "vitest";
import { refreshSubagent, cancelSubagent } from "./subagent-management";
const agent = {
  id: "child",
  parentId: "root",
  description: "test",
  agentType: "explore",
  status: "unknown",
  transcript: { blocks: [], plan: [] },
};
it("refreshes the nested Grok snapshot without dropping saved content", async () => {
  const request = vi.fn().mockResolvedValue({
    result: {
      snapshot: {
        childSessionId: "child",
        status: "completed",
        output: "done",
        toolCalls: 2,
        turns: 1,
        durationMs: 1000,
      },
    },
  });
  expect(await refreshSubagent(request, agent)).toMatchObject({
    status: "completed",
    output: "done",
    toolCalls: 2,
  });
  expect(request).toHaveBeenCalledWith("_x.ai/subagent/get", { subagentId: "child", block: false });
});
it("missing tasks are errors, not successful cancellations", async () => {
  const request = vi
    .fn()
    .mockResolvedValue({ result: { cancelled: false, outcome: { kind: "not_found" } } });
  await expect(cancelSubagent(request, "child")).rejects.toThrow("未找到");
  request.mockResolvedValue({ result: { cancelled: true, outcome: { kind: "cancelled" } } });
  expect(await cancelSubagent(request, "child")).toContain("取消请求已发送");
  request.mockResolvedValue({ result: { snapshot: null } });
  await expect(refreshSubagent(request, agent)).rejects.toThrow("已保留历史内容");
});
