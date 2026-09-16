import { describe, it, expect } from "vitest";
import { Marked } from "marked";
import { filePathMarkdown } from "./file-path-markdown";
const md = new Marked(filePathMarkdown);
describe("preview path rendering", () => {
  it("links inline code media paths including Windows spaces and Chinese", () => {
    for (const path of [
      "videos/1.mp4",
      String.raw`D:\视频剪辑\项目\2026-08-10_Codex用量\deliverables\final.mp4`,
      "C:/项目/一 张图.png",
      "../paper/main.pdf",
    ]) {
      expect(md.parse("`" + path + "`")).toContain('data-local-file="' + path + '"');
    }
  });
  it("recognizes plain paths and keeps sentence punctuation outside", () => {
    expect(md.parse("预览 videos/1.mp4。下一段")).toContain('data-local-file="videos/1.mp4"');
    expect(md.parse(String.raw`文件 D:\中文目录\报告.pdf。`)).toContain(
      'data-local-file="D:\\中文目录\\报告.pdf"',
    );
  });
  it("keeps commands, fenced code and external URLs unchanged", () => {
    expect(
      md.parse("`npm run dev`\n\n```sh\nvideos/1.mp4\n```\n\nhttps://example.com/demo.mp4"),
    ).not.toContain("data-local-file");
    expect(md.parse("[video](https://example.com/demo.mp4)")).not.toContain("data-local-file");
  });
});
