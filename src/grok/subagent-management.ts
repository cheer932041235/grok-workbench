import type { Subagent } from "./protocol";
type Request = (
  method: string,
  params: Record<string, unknown>,
) => Promise<Record<string, unknown>>;
function payload(response: Record<string, unknown>): Record<string, unknown> {
  if (response.error) throw new Error(String(response.error));
  if (!response.result || typeof response.result !== "object")
    throw new Error("Grok 返回了无法识别的子任务响应");
  return response.result as Record<string, unknown>;
}
export async function refreshSubagent(request: Request, agent: Subagent): Promise<Subagent> {
  const data = payload(await request("_x.ai/subagent/get", { subagentId: agent.id, block: false }));
  const snapshot = data.snapshot as Record<string, unknown> | null;
  if (!snapshot) throw new Error("当前 Grok 进程中未找到此子任务，已保留历史内容");
  if (snapshot.childSessionId !== agent.id) throw new Error("子任务响应与当前记录不匹配");
  const status =
    snapshot.status === "running"
      ? "in_progress"
      : snapshot.status === "initializing"
        ? "pending"
        : String(snapshot.status);
  return {
    ...agent,
    status,
    output: typeof snapshot.output === "string" ? snapshot.output : agent.output,
    error: typeof snapshot.failureError === "string" ? snapshot.failureError : agent.error,
    turns: Number(snapshot.turnCount ?? snapshot.turns ?? agent.turns ?? 0),
    toolCalls: Number(snapshot.toolCallCount ?? snapshot.toolCalls ?? agent.toolCalls ?? 0),
    durationMs: Number(snapshot.durationMs ?? agent.durationMs ?? 0),
  };
}
export async function cancelSubagent(request: Request, id: string): Promise<string> {
  const data = payload(await request("_x.ai/subagent/cancel", { subagentId: id }));
  const outcome = data.outcome as { kind?: string } | undefined;
  if (outcome?.kind === "not_found") throw new Error("当前 Grok 进程中未找到此子任务");
  if (data.cancelled === true) return "取消请求已发送，等待 Grok 确认";
  if (outcome?.kind === "already_finished") return "子任务已经结束，可刷新查看最终状态";
  throw new Error("Grok 未确认取消，请刷新查看任务状态");
}
