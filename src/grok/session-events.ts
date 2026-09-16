import { applyUpdate, type RpcMessage, type Transcript, type Subagent } from "./protocol";

export const sessionMethods = [
  "session/update",
  "_x.ai/session/update",
  "x.ai/session/update",
  "_x.ai/session_notification",
  "x.ai/session_notification",
];

/** Child streams must never be appended to the root conversation. */
export function applySessionEvent(
  state: Transcript,
  rootId: string,
  message: RpcMessage,
): Transcript {
  if (!sessionMethods.includes(message.method ?? "")) return state;
  const source = message.params?.sessionId;
  const update = message.params?.update as Record<string, unknown> | undefined;
  if (!update) return state;
  const children = state.subagents ?? [];
  const childIndex = children.findIndex((child) => child.id === source);
  if (source !== rootId && childIndex < 0) return state;
  const kind = update.sessionUpdate;
  if (source === rootId && kind === "background_tasks" && Array.isArray(update.tasks))
    return { ...state, backgroundTasks: update.tasks };
  if (source === rootId && kind === "hook_execution") {
    const runs = Array.isArray(update.runs) ? update.runs : [];
    return {
      ...state,
      activity: [
        ...(state.activity ?? []),
        {
          label: "会话自动操作",
          detail: JSON.stringify(update, null, 2),
          failed: runs.some((run) => ["failed", "failure", "error"].includes(run.status?.status)),
        },
      ],
    };
  }
  if (["subagent_spawned", "subagent_progress", "subagent_finished"].includes(String(kind))) {
    const id = update.child_session_id;
    if (typeof id !== "string") return state;
    const index = children.findIndex((child) => child.id === id);
    if (index < 0 && kind !== "subagent_spawned") return state;
    const child: Subagent =
      index >= 0
        ? { ...children[index] }
        : {
            id,
            parentId: String(source),
            description: String(update.description ?? "子任务"),
            agentType: String(update.subagent_type ?? ""),
            status: "in_progress",
            transcript: { blocks: [], plan: [] },
          };
    if (kind === "subagent_spawned") child.status = "in_progress";
    if (kind === "subagent_finished") {
      child.status = String(update.status);
      if (typeof update.output === "string") child.output = update.output;
      if (typeof update.error === "string") child.error = update.error;
    }
    if (typeof update.duration_ms === "number") child.durationMs = update.duration_ms;
    const turns = update.turn_count ?? update.turns;
    const calls = update.tool_call_count ?? update.tool_calls;
    if (typeof turns === "number") child.turns = turns;
    if (typeof calls === "number") child.toolCalls = calls;
    const subagents = [...children];
    if (index < 0) subagents.push(child);
    else subagents[index] = child;
    return { ...state, subagents };
  }
  if (message.method !== "session/update") return state;
  if (childIndex >= 0) {
    const subagents = [...children];
    subagents[childIndex] = {
      ...children[childIndex],
      transcript: applyUpdate(children[childIndex].transcript, update),
    };
    return { ...state, subagents };
  }
  if (kind === "user_message_chunk") return state;
  const next = applyUpdate(state, update);
  const meta = message.params?._meta as Record<string, unknown> | undefined;
  if (
    kind === "agent_thought_chunk" &&
    next !== state &&
    typeof meta?.agentTimestampMs === "number" &&
    typeof meta.streamStartMs === "number"
  ) {
    const elapsed = meta.agentTimestampMs - meta.streamStartMs;
    const blocks = [...next.blocks];
    const last = blocks.at(-1);
    if (last?.type === "thought" && elapsed >= 0) {
      blocks[blocks.length - 1] = { ...last, durationMs: elapsed };
      return { ...next, blocks };
    }
  }
  return next;
}

export function restoreSubagents(state: Transcript): Transcript {
  return {
    ...state,
    subagents: state.subagents?.map((child) => ({
      ...child,
      status: ["in_progress", "pending"].includes(child.status) ? "unknown" : child.status,
    })),
  };
}
