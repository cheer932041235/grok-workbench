import katex from "katex";
import type { TokenizerAndRendererExtension } from "marked";

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Parse math before Markdown consumes backslashes; fenced/inline code stays with Marked. */
export const mathExtensions: TokenizerAndRendererExtension[] = [
  {
    name: "displayMath",
    level: "block",
    start: (src) => src.search(/(?:^|\n)[ \t]*(?:\$\$|\\\[)/),
    tokenizer(src) {
      const open = /^(?:\$\$|\\\[)/.exec(src)?.[0];
      if (!open) return;
      const close = open === "$$" ? "$$" : "\\]";
      const end = src.indexOf(close, open.length);
      if (end < 0) return { type: "displayMath", raw: src, text: src, pending: true };
      return {
        type: "displayMath",
        raw: src.slice(0, end + close.length),
        text: src.slice(open.length, end).trim(),
      };
    },
    renderer(token) {
      if (token.pending) return `<pre class="math-pending">${escape(token.text)}</pre>`;
      return `<div class="math-block"><button class="math-copy" data-math-copy="${escape(token.text)}" aria-label="复制公式源码">复制公式</button><div class="math-scroll">${katex.renderToString(token.text, { displayMode: true, throwOnError: false, errorColor: "#dfac9d", trust: false })}</div></div>`;
    },
  },
  {
    name: "inlineMath",
    level: "inline",
    start: (src) => src.search(/\\\(|\$/),
    tokenizer(src) {
      if (src.startsWith("\\(")) {
        const end = src.indexOf("\\)", 2);
        if (end < 0) return { type: "inlineMath", raw: src, text: src, pending: true };
        return { type: "inlineMath", raw: src.slice(0, end + 2), text: src.slice(2, end) };
      }
      // Avoid treating "$5 and $10" as math. Dollar math must close without whitespace.
      const match = /^\$([^\s$](?:[^$\n]*?[^\s$])?)(?<!\\)\$(?!\d)/.exec(src);
      if (match) return { type: "inlineMath", raw: match[0], text: match[1] };
    },
    renderer(token) {
      if (token.pending) return `<span class="math-pending">${escape(token.text)}</span>`;
      return katex.renderToString(token.text, {
        throwOnError: false,
        errorColor: "#dfac9d",
        trust: false,
      });
    },
  },
];
