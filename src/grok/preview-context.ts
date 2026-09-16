import type { Block } from "./protocol";
export function previewContext(blocks: Block[]) {
  const paths = new Set<string>();
  const skills = new Set<string>();
  function read(value: unknown) {
    if (typeof value === "string") {
      for (const match of value.matchAll(
        /[A-Za-z]:[\\/][^\r\n`"'<>|]*|\/(?:Users|home|mnt)\/[^\r\n`"'<>|]*/g,
      ))
        paths.add(match[0].trim().replace(/[，。；]+$/, ""));
      for (const match of value.matchAll(/\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g))
        skills.add(match[0]);
    } else if (Array.isArray(value)) value.forEach(read);
    else if (value && typeof value === "object") Object.values(value).forEach(read);
  }
  for (const block of blocks) {
    if (block.type === "tool") {
      read(block.tool.locations);
      read(block.tool.rawInput);
      read(block.tool.title);
      const output = block.tool.rawOutput as
        | { output_file?: string; current_dir?: string }
        | undefined;
      read(output?.output_file);
      read(output?.current_dir);
    } else read(block.text);
  }
  return { paths: [...paths], skills: [...skills] };
}
