import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { RpcMessage } from "./protocol";

export class GrokClient {
  generation = 0;
  private nextId = 0;
  private pending = new Map<
    number | string,
    { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }
  >();
  private unlisten: UnlistenFn[] = [];
  constructor(
    private event: (message: RpcMessage) => void,
    private diagnostic: (text: string) => void,
    private exit: (status: string) => void,
  ) {}

  async mount() {
    this.unlisten.push(
      await listen<{ generation: number; message: RpcMessage }>("grok-message", ({ payload }) => {
        if (payload.generation !== this.generation) return;
        const message = payload.message;
        if (message.id !== undefined && !message.method) {
          const pending = this.pending.get(message.id);
          if (pending) {
            this.pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message));
            else pending.resolve(message.result ?? {});
          }
        } else this.event(message);
      }),
    );
    this.unlisten.push(
      await listen<{ generation: number; text: string }>("grok-diagnostic", ({ payload }) => {
        if (payload.generation === this.generation) this.diagnostic(payload.text);
      }),
    );
    this.unlisten.push(
      await listen<{ generation: number; status: string }>("grok-exit", ({ payload }) => {
        if (payload.generation !== this.generation) return;
        this.generation = 0;
        this.rejectPending("Grok 进程已退出");
        this.exit(payload.status);
      }),
    );
  }
  async connect(executable: string, cwd: string, permissionMode: string) {
    this.generation = await invoke<number>("grok_connect", { executable, cwd, permissionMode });
    return this.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: "grok-workbench", version: "0.1.0" },
    });
  }
  send(message: RpcMessage) {
    return invoke<void>("grok_send", {
      generation: this.generation,
      message: { jsonrpc: "2.0", ...message },
    });
  }
  request(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ id, method, params }).catch((error) => {
        this.pending.delete(id);
        reject(error);
      });
    });
  }
  private rejectPending(reason: string) {
    for (const pending of this.pending.values()) pending.reject(new Error(reason));
    this.pending.clear();
  }
  async disconnect() {
    this.generation = 0;
    this.rejectPending("会话已断开");
    await invoke("grok_disconnect");
  }
  dispose() {
    this.unlisten.forEach((fn) => fn());
    this.rejectPending("界面已关闭");
  }
}
