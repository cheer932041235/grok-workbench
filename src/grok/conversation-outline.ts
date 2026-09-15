import type { Block } from "./protocol";
export interface QuestionEntry {
  blockIndex: number;
  number: number;
  title: string;
}
export function questionOutline(blocks: Block[]): QuestionEntry[] {
  const entries: QuestionEntry[] = [];
  blocks.forEach((block, blockIndex) => {
    if (block.type !== "user") return;
    const title = block.text.slice(0, 500).replace(/\s+/g, " ").trim();
    entries.push({
      blockIndex,
      number: entries.length + 1,
      title: title || (block.images?.length ? "图片提问" : "空白提问"),
    });
  });
  return entries;
}
