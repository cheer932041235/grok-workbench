import type { Block } from "./protocol";
export function visibleBlock(block: Block, filter: string): boolean {
  if (block.type === "tool" && ["failed", "interrupted"].includes(block.tool.status ?? ""))
    return true;
  return (
    filter === "all" ||
    (filter === "answers"
      ? block.type === "answer" || block.type === "user"
      : block.type === "tool")
  );
}
