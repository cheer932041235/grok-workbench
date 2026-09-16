export interface Content {
  type: string;
  text?: string;
  path?: string;
  oldText?: string | null;
  newText?: string;
  content?: Content;
}
export interface Tool {
  toolCallId: string;
  title?: string;
  kind?: string;
  status?: string;
  content?: Content[];
  rawInput?: unknown;
  rawOutput?: unknown;
  locations?: { path: string; line?: number }[];
}
export interface PlanEntry {
  content: string;
  status: string;
  priority?: string;
}
export interface ConfigOption {
  id: string;
  name: string;
  type: string;
  currentValue: string;
  options: { value: string; name: string }[];
}
export interface Update extends Partial<Tool> {
  sessionUpdate: string;
  content?: never;
  entries?: PlanEntry[];
  configOptions?: ConfigOption[];
}
export type Block =
  | { type: "user"; text: string; images?: PromptImage[] }
  | { type: "answer" | "thought"; text: string; durationMs?: number }
  | { type: "tool"; tool: Tool };
export interface Activity {
  label: string;
  detail: string;
  failed?: boolean;
}
export interface Transcript {
  activity?: Activity[];
  backgroundTasks?: unknown[];
  researchContext?: string;
  blocks: Block[];
  plan: PlanEntry[];
  subagents?: Subagent[];
}
export interface Subagent {
  id: string;
  parentId: string;
  description: string;
  agentType: string;
  status: string;
  output?: string;
  error?: string;
  turns?: number;
  toolCalls?: number;
  durationMs?: number;
  transcript: Transcript;
}
export interface SessionRecord extends Transcript {
  archived?: boolean;
  pendingConfig?: Record<string, string>;
  draft?: string;
  draftImages?: PromptImage[];
  queuedPrompts?: (string | { text: string; images?: PromptImage[] })[];
  sessionId: string;
  title: string;
  cwd: string;
  updatedAt: string;
}
export interface RpcMessage {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}
export interface Permission {
  id: number | string;
  params: {
    sessionId: string;
    toolCall: Tool;
    options: { optionId: string; name: string; kind: string }[];
  };
}

/** ACP tool updates are patches: absent fields must preserve earlier content. */
export function applyUpdate(state: Transcript, raw: Record<string, unknown>): Transcript {
  const blocks = [...state.blocks];
  const kind = raw.sessionUpdate;
  if (
    kind === "agent_message_chunk" ||
    kind === "agent_thought_chunk" ||
    kind === "user_message_chunk"
  ) {
    const content = raw.content as Content | undefined;
    if (content?.type !== "text" || !content.text) return state;
    const type =
      kind === "agent_message_chunk"
        ? "answer"
        : kind === "agent_thought_chunk"
          ? "thought"
          : "user";
    const last = blocks.at(-1);
    if (last && last.type === type && "text" in last)
      blocks[blocks.length - 1] = { ...last, text: last.text + content.text };
    else blocks.push({ type, text: content.text });
  } else if (kind === "tool_call" || kind === "tool_call_update") {
    const tool = raw as unknown as Tool;
    const index = blocks.findIndex(
      (b) => b.type === "tool" && b.tool.toolCallId === tool.toolCallId,
    );
    if (index < 0) blocks.push({ type: "tool", tool: { ...tool } });
    else {
      const previous = blocks[index];
      if (previous.type === "tool")
        blocks[index] = { type: "tool", tool: { ...previous.tool, ...tool } };
    }
  } else if (kind === "plan") {
    return { ...state, blocks, plan: (raw.entries as PlanEntry[]) ?? [] };
  }
  return { ...state, blocks };
}

export function toolText(tool: Tool): string {
  const content = (tool.content ?? [])
    .map((item) => (item.type === "content" ? (item.content?.text ?? "") : (item.text ?? "")))
    .filter(Boolean)
    .join("\n");
  if (content) return content;
  const raw = tool.rawOutput as Record<string, unknown> | undefined;
  if (typeof raw === "string") return raw;
  if (!raw || typeof raw !== "object") return "";
  for (const [key, field] of [
    ["FileContent", "raw_output"],
    ["Content", "content"],
    ["EditsApplied", "tool_output_for_prompt"],
  ]) {
    const text = (raw[key] as Record<string, unknown> | undefined)?.[field];
    if (typeof text === "string") return text;
  }
  const streams = [raw.output, raw.stdout, raw.stderr]
    .map((value) => {
      if (typeof value === "string") return value;
      if (
        Array.isArray(value) &&
        value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
      )
        return new TextDecoder().decode(new Uint8Array(value));
      return "";
    })
    .filter(Boolean)
    .join("\n");
  return streams || (typeof raw.message === "string" ? raw.message : "");
}
export function toolStatus(status?: string): string {
  return (
    (
      {
        pending: "等待执行",
        in_progress: "执行中",
        completed: "已完成",
        failed: "执行失败",
        interrupted: "已中断",
      } as Record<string, string>
    )[status ?? ""] ??
    status ??
    "等待执行"
  );
}
import type { PromptImage } from "./images";
