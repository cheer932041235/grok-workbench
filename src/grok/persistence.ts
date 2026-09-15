import type { SessionRecord } from "./protocol";
import { sameSessionContent } from "./history";

export class SessionSaver {
  private saved?: SessionRecord;
  private tail: Promise<void> = Promise.resolve();
  constructor(
    private write: (record: SessionRecord) => Promise<void>,
    private onSaved?: (record: SessionRecord) => void,
  ) {}
  remember(record?: SessionRecord) {
    this.saved = record ? JSON.parse(JSON.stringify(record)) : undefined;
  }
  save(record: SessionRecord, before: Promise<void> = Promise.resolve()): Promise<void> {
    const snapshot: SessionRecord = JSON.parse(JSON.stringify(record));
    this.tail = this.tail
      .catch(() => {})
      .then(async () => {
        await before.catch(() => {});
        if (sameSessionContent(snapshot, this.saved)) return;
        await this.write(snapshot);
        this.saved = snapshot;
        this.onSaved?.(snapshot);
      });
    return this.tail;
  }
  flush() {
    return this.tail;
  }
}
