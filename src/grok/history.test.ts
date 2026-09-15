import { expect, it } from "vitest";
import { sameSessionContent } from "./history";
import type { SessionRecord } from "./protocol";

it("opening unchanged history preserves recency even when JSON key order differs", () => {
  const record: SessionRecord = {
    sessionId: "one",
    title: "标题",
    cwd: "project",
    blocks: [{ type: "answer", text: "正文" }],
    plan: [],
    updatedAt: "old",
  };
  const reordered: SessionRecord = {
    ...record,
    blocks: [{ text: "正文", type: "answer" }],
    updatedAt: "new",
  };
  expect(sameSessionContent(record, reordered)).toBe(true);
  expect(sameSessionContent({ ...record, draft: "未发送内容" }, record)).toBe(false);
  expect(sameSessionContent({ ...record, archived: true }, record)).toBe(false);
  expect(sameSessionContent({ ...record, title: "新标题" }, record)).toBe(false);
});

it("materializes CLI text, images and child output without changing archive state", async () => {
  const { materializeHistory, historySummary } = await import("./history");
  const record = materializeHistory({
    sessionId: "root",
    title: "Imported",
    cwd: "project",
    updatedAt: "old",
    archived: true,
    blocks: [],
    plan: [],
    source: "grok-cli",
    importedEvents: [
      {
        method: "session/update",
        params: {
          sessionId: "root",
          update: {
            sessionUpdate: "user_message_chunk",
            content: { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
          },
        },
      },
      {
        method: "session/update",
        params: {
          sessionId: "root",
          update: {
            sessionUpdate: "user_message_chunk",
            content: { type: "text", text: "解释图片" },
          },
        },
      },
      {
        method: "session/update",
        params: {
          sessionId: "root",
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "图片解释" },
          },
        },
      },
      {
        method: "_x.ai/session/update",
        params: {
          sessionId: "root",
          update: {
            sessionUpdate: "subagent_spawned",
            child_session_id: "child",
            description: "检查图片",
          },
        },
      },
      {
        method: "session/update",
        params: {
          sessionId: "child",
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "子任务内容" },
          },
        },
      },
    ],
  });
  expect(record.blocks).toHaveLength(2);
  expect(record.blocks[0]).toMatchObject({
    type: "user",
    text: "解释图片",
    images: [{ data: "aGVsbG8=" }],
  });
  expect(record.subagents?.[0].transcript.blocks).toHaveLength(1);
  expect(record.importedEvents).toBeUndefined();
  expect(record.archived).toBe(true);
  expect(historySummary(record)).not.toHaveProperty("blocks");
});
