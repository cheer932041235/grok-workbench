import { applyUpdate, type SessionRecord, type RpcMessage, type Transcript } from "./protocol";
import { applySessionEvent } from "./session-events";

export type HistorySummary = Pick<
  SessionRecord,
  "sessionId" | "title" | "cwd" | "updatedAt" | "archived"
> & { source?: string };
export type StoredSession = SessionRecord & { source?: string; importedEvents?: RpcMessage[] };
export function historySummary(record: StoredSession): HistorySummary {
  const { sessionId, title, cwd, updatedAt, archived, source } = record;
  return { sessionId, title, cwd, updatedAt, archived, source };
}

/** Imported logs include root user chunks; live notifications do not duplicate them. */
export function materializeHistory(record: StoredSession): StoredSession {
  if (!record.importedEvents) return record;
  let transcript: Transcript = {
    goal: record.goal,
    workflows: record.workflows,
    activity: record.activity,
    backgroundTasks: record.backgroundTasks,
    researchContext: record.researchContext,
    blocks: record.blocks,
    plan: record.plan,
    subagents: record.subagents,
  };
  for (const message of record.importedEvents) {
    const update = message.params?.update as Record<string, unknown> | undefined;
    if (
      message.params?.sessionId === record.sessionId &&
      update?.sessionUpdate === "user_message_chunk"
    ) {
      const content = update.content as
        | { type: string; text?: string; data?: string; mimeType?: string }
        | undefined;
      if (content?.type === "image" && content.data && content.mimeType) {
        const image = { name: "历史图片", data: content.data, mimeType: content.mimeType };
        const blocks = [...transcript.blocks];
        const last = blocks.at(-1);
        if (last?.type === "user")
          blocks[blocks.length - 1] = { ...last, images: [...(last.images ?? []), image] };
        else blocks.push({ type: "user", text: "", images: [image] });
        transcript = { ...transcript, blocks };
      } else transcript = applyUpdate(transcript, update);
    } else transcript = applySessionEvent(transcript, record.sessionId, message);
  }
  const { importedEvents: _events, ...saved } = record;
  return { ...saved, ...transcript };
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  return (
    keys.length === Object.keys(right).filter((key) => right[key] !== undefined).length &&
    keys.every((key) => equal(left[key], right[key]))
  );
}

/** Merely opening or closing an unchanged conversation must not change its recency. */
export function sameSessionContent(a: SessionRecord, b?: SessionRecord): boolean {
  if (!b) return false;
  return equal({ ...a, updatedAt: undefined }, { ...b, updatedAt: undefined });
}
