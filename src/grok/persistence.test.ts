import { expect, it, vi } from "vitest";
import { SessionSaver } from "./persistence";
import type { SessionRecord } from "./protocol";
const record = (draft: string): SessionRecord => ({
  sessionId: "one",
  title: "test",
  cwd: "project",
  updatedAt: "now",
  blocks: [],
  plan: [],
  draft,
});
it("saves the final A after a delayed B write even when disk initially contained A", async () => {
  let release!: () => void;
  const writes: string[] = [];
  const saver = new SessionSaver(async (snapshot) => {
    writes.push(snapshot.draft!);
    if (snapshot.draft === "B")
      await new Promise<void>((resolve) => {
        release = resolve;
      });
  });
  saver.remember(record("A"));
  const first = saver.save(record("B"));
  await vi.waitFor(() => expect(writes).toEqual(["B"]));
  const last = saver.save(record("A"));
  release();
  await first;
  await last;
  expect(writes).toEqual(["B", "A"]);
});
it("does not repeat queued identical writes and allows a new save after a reported failure", async () => {
  const write = vi.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
  const saver = new SessionSaver(write);
  await expect(saver.save(record("A"))).rejects.toThrow("disk full");
  await Promise.all([saver.save(record("A")), saver.save(record("A"))]);
  expect(write).toHaveBeenCalledTimes(2);
});
it("orders a full save after an in-flight draft write and preserves its captured input", async () => {
  let release!: () => void;
  const writes: string[] = [];
  const saver = new SessionSaver(async (value) => {
    writes.push(value.draft!);
  });
  saver.remember(record("A"));
  const draftWrite = new Promise<void>((resolve) => {
    release = resolve;
  }).then(() => {
    writes.push("B");
    saver.remember();
  });
  const input = record("A");
  const fullSave = saver.save(input, draftWrite);
  input.draft = "later input";
  await Promise.resolve();
  expect(writes).toEqual([]);
  release();
  await fullSave;
  expect(writes).toEqual(["B", "A"]);
});
