import { beforeEach, expect, it, vi } from "vitest";
import { GrokClient } from "./client";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

it("does not initialize a connection that was cancelled while the process was starting", async () => {
  let finish!: (generation: number) => void;
  vi.mocked(invoke).mockImplementation((command) => {
    if (command === "grok_connect")
      return new Promise<number>((resolve) => {
        finish = resolve;
      });
    return Promise.resolve();
  });
  const client = new GrokClient(vi.fn(), vi.fn(), vi.fn());
  const connecting = client.connect("grok", "project", "default");
  const rejected = expect(connecting).rejects.toThrow("连接已取消");
  await client.disconnect();
  finish(1);
  await rejected;
  expect(client.generation).toBe(0);
  expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).toEqual([
    "grok_connect",
    "grok_disconnect",
  ]);
});
