import { describe, it, expect } from "vitest";
import { PromptQueue, type QueueView } from "./queue";

const deferred = () => {
  let resolve!: (ok: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  return { promise, resolve };
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("conversation prompt queue", () => {
  it("sends in order without overlapping and allows editing pending messages", async () => {
    const first = deferred();
    const calls: string[] = [];
    let view!: QueueView;
    const queue = new PromptQueue(
      async (text) => {
        calls.push(text);
        return calls.length === 1 ? first.promise : true;
      },
      (v) => (view = v),
    );
    queue.enqueue("first");
    queue.enqueue("second");
    queue.enqueue("third");
    queue.enqueue("delete me");
    expect(calls).toEqual(["first"]);
    queue.edit(view.pending[0].id, "edited second");
    queue.moveUp(view.pending[1].id);
    queue.remove(view.pending[2].id);
    first.resolve(true);
    await settle();
    expect(calls).toEqual(["first", "third", "edited second"]);
    expect(view.running).toBe(false);
  });
  it("pauses on failure and resumes remaining messages explicitly", async () => {
    const first = deferred();
    const calls: string[] = [];
    let view!: QueueView;
    const queue = new PromptQueue(
      async (text) => {
        calls.push(text);
        return calls.length === 1 ? first.promise : true;
      },
      (v) => (view = v),
    );
    queue.enqueue("first");
    queue.enqueue("second");
    first.resolve(false);
    await settle();
    expect(view.paused).toBe(true);
    expect(calls).toEqual(["first"]);
    queue.resume();
    await settle();
    expect(calls).toEqual(["first", "second"]);
  });
  it("stopping the current prompt prevents automatic dispatch and restored queues stay paused", async () => {
    const first = deferred();
    const calls: string[] = [];
    let view!: QueueView;
    const queue = new PromptQueue(
      async (text) => {
        calls.push(text);
        return first.promise;
      },
      (v) => (view = v),
    );
    queue.enqueue("first");
    queue.enqueue("second");
    queue.pause();
    first.resolve(true);
    await settle();
    expect(calls).toEqual(["first"]);
    expect(view.pending.map((x) => x.text)).toEqual(["second"]);
    queue.restore(["saved third"]);
    await settle();
    expect(calls).toEqual(["first"]);
    queue.resume();
    await settle();
    expect(calls).toEqual(["first", "saved third"]);
  });
});
