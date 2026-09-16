import type { MarkedExtension } from "marked";
import { escapeHtml } from "$lib/utils/ansi";
import { parseFileLink } from "./file-links";

const extensions =
  "pdf|png|jpe?g|gif|webp|bmp|mp4|webm|mov|m4v|mp3|wav|ogg|md|markdown|txt|csv|json|jsonl|ts|tsx|js|jsx|py|rs|svelte|vue|html|css|yaml|yml|toml|tex|log|svg";
const fileEnding = new RegExp(`\\.(?:${extensions})(?::\\d+(?::\\d+)?|#L\\d+(?:-L?\\d+)?)?$`, "i");
const barePath = new RegExp(
  `^(?:[a-z]:[\\\\/]|\\.{1,2}/|/|[\\w\\u3400-\\u9fff.-]+/)[^\\n\\r<>\x60"|?*]*?\\.(?:${extensions})(?::\\d+(?::\\d+)?|#L\\d+(?:-L?\\d+)?)?(?=$|[\\s，。；、！!？)）\\]}>])`,
  "i",
);
const startPath = /[a-z]:[\\/]|\.{1,2}\/|\/[\w\u3400-\u9fff]|[\w\u3400-\u9fff.-]+\//i;
function link(path: string, label: string) {
  return `<a href="#" class="local-file-link" data-local-file="${escapeHtml(path)}" title="在右侧预览">${label}</a>`;
}
export const filePathMarkdown: MarkedExtension = {
  renderer: {
    codespan({ text }) {
      const code = `<code>${escapeHtml(text)}</code>`;
      return fileEnding.test(text) && parseFileLink(text) ? link(text, code) : code;
    },
  },
  extensions: [
    {
      name: "localFilePath",
      level: "inline",
      start: (src) => src.search(startPath),
      tokenizer(src) {
        if (this.lexer.state.inLink) return;
        const path = barePath.exec(src)?.[0];
        if (path && parseFileLink(path)) return { type: "localFilePath", raw: path, text: path };
      },
      renderer(token) {
        return link(token.text, escapeHtml(token.text));
      },
    },
  ],
};
