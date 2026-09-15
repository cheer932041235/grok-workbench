import { describe, it, expect } from "vitest";
import { Marked } from "marked";
import { mathExtensions } from "./math";
const markdown = new Marked({ extensions: mathExtensions });
const render = (text: string) => markdown.parse(text) as string;
describe("formula display scenarios", () => {
  it("renders Grok delimiters before Markdown consumes them", () => {
    const html = render(String.raw`行内 \(x_i^2\)，以及 $y=2$。

\[
\min_{w,b}\frac12\|w\|^2
\]`);
    expect(html.match(/class="katex"/g)).toHaveLength(3);
    expect(html).toContain("data-math-copy=");
  });
  it("renders matrix and aligned display math", () => {
    expect(render(String.raw`$$\begin{pmatrix}1&2\\3&4\end{pmatrix}$$`)).toContain('class="katex"');
    expect(render(String.raw`\[\begin{aligned}a&=b\\c&=d\end{aligned}\]`)).not.toContain(
      "katex-error",
    );
  });
  it("leaves inline and fenced code literal", () => {
    const html = render("`$x$`\n\n```tex\n\\[x^2\\]\n```");
    expect(html).not.toContain('class="katex"');
    expect(html).toContain("\\[x^2\\]");
  });
  it("does not convert currency or escaped dollar signs", () => {
    expect(render(String.raw`价格 $5 和 $10；转义 \$x。`)).not.toContain('class="katex"');
  });
  it("keeps an unfinished streamed formula readable and renders after closure", () => {
    const pending = String.raw`\[\frac{1}{2}`;
    expect(render(pending)).toContain("math-pending");
    expect(render(pending)).toContain("\\frac{1}{2}");
    expect(render(pending + "\\]")).toContain('class="katex"');
  });
  it("shows invalid math without losing the following paragraph", () => {
    const html = render("$$\\frac{1}$$\n\n后续回答");
    expect(html).toContain("katex-error");
    expect(html).toContain("后续回答");
  });
});
