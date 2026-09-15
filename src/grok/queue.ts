import type { PromptImage } from "./images";
export interface QueuedPrompt {
  id: number;
  text: string;
  images?: PromptImage[];
}
export interface QueueView {
  pending: QueuedPrompt[];
  running: boolean;
  paused: boolean;
}

/** One conversation, one in-flight prompt; later messages keep their submission order. */
export class PromptQueue {
  private pending: QueuedPrompt[] = [];
  private running = false;
  private paused = false;
  private nextId = 0;
  constructor(
    private execute: (text: string, images?: PromptImage[]) => Promise<boolean>,
    private changed: (view: QueueView) => void,
  ) {}
  private publish() {
    this.changed({
      pending: this.pending.map((item) => ({ ...item })),
      running: this.running,
      paused: this.paused,
    });
  }
  enqueue(text: string, images: PromptImage[] = []) {
    if (!text.trim() && !images.length) return;
    if (!this.running && !this.pending.length) this.paused = false;
    this.pending.push({ id: ++this.nextId, text: text.trim(), images: [...images] });
    this.publish();
    void this.drain();
  }
  edit(id: number, text: string) {
    const item = this.pending.find((item) => item.id === id);
    if (item && text.trim()) {
      item.text = text.trim();
      this.publish();
    }
  }
  remove(id: number) {
    this.pending = this.pending.filter((item) => item.id !== id);
    this.publish();
  }
  moveUp(id: number) {
    const index = this.pending.findIndex((item) => item.id === id);
    if (index > 0) {
      [this.pending[index - 1], this.pending[index]] = [
        this.pending[index],
        this.pending[index - 1],
      ];
      this.publish();
    }
  }
  pause() {
    this.paused = true;
    this.publish();
  }
  resume() {
    this.paused = false;
    this.publish();
    void this.drain();
  }
  restore(texts: (string | { text: string; images?: PromptImage[] })[]) {
    if (this.running) throw new Error("当前任务完成后才能切换队列");
    this.pending = texts.map((value) => ({
      id: ++this.nextId,
      ...(typeof value === "string" ? { text: value } : value),
    }));
    this.paused = texts.length > 0;
    this.publish();
  }
  private async drain() {
    if (this.running || this.paused || !this.pending.length) return;
    this.running = true;
    this.publish();
    try {
      while (this.pending.length && !this.paused) {
        const item = this.pending.shift()!;
        this.publish();
        try {
          if (!(await this.execute(item.text, item.images))) this.paused = true;
        } catch {
          this.paused = true;
        }
        this.publish();
      }
    } finally {
      this.running = false;
      this.publish();
    }
  }
}
