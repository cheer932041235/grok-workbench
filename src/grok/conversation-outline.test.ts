import { expect, it } from "vitest";
import { questionOutline } from "./conversation-outline";
it("keeps original block anchors and question numbers across unequal answers and tool blocks", () => {
  expect(
    questionOutline([
      { type: "user", text: "第一问\n继续说明" },
      { type: "answer", text: "answer" },
      { type: "tool", tool: { toolCallId: "one" } },
      { type: "user", text: "第二问" },
    ]),
  ).toEqual([
    { blockIndex: 0, number: 1, title: "第一问 继续说明" },
    { blockIndex: 3, number: 2, title: "第二问" },
  ]);
});
it("includes image-only questions and keeps duplicate questions separately navigable", () => {
  const entries = questionOutline([
    { type: "user", text: "", images: [{ name: "image.png", mimeType: "image/png", data: "" }] },
    { type: "user", text: "继续" },
    { type: "answer", text: "long" },
    { type: "user", text: "继续" },
  ]);
  expect(entries.map((e) => e.title)).toEqual(["图片提问", "继续", "继续"]);
  expect(entries.map((e) => e.blockIndex)).toEqual([0, 1, 3]);
});
