<script lang="ts">
  import RichText from "./RichText.svelte";
  import ToolCard from "./ToolCard.svelte";
  import InteractionCard from "./InteractionCard.svelte";
  import ThoughtBlock from "./ThoughtBlock.svelte";
  let width = $state(900);
  let size = $state(18);
  let stream = $state("");
  let response = $state("");
  let playing = $state(false);
  const formula = String.raw`## 支持向量机
行内公式 \(f(x)=w^\top x+b\)，与 $\xi_i\ge 0$。

\[
\min_{w,b,\xi}\quad \frac{1}{2}\|w\|^2+C\sum_{i=1}^{n}\xi_i
\]

$$\begin{aligned}y_i(w^\top x_i+b)&\ge 1-\xi_i\\\xi_i&\ge0\end{aligned}$$

矩阵：\(A=\begin{pmatrix}1&2\\3&4\end{pmatrix}\)。价格 $5 和 $10 不应变成公式。`;
  const code =
    '```typescript\nconst text = "$x$ stays code";\n' +
    Array.from(
      { length: 45 },
      (_, i) => `console.log("第 ${i + 1} 行", "${"long_value_".repeat(16)}");`,
    ).join("\n") +
    "\n```";
  const table =
    "| 模型 | Accuracy | Precision | Recall | F1 | 样本 | 时间 | 备注 |\n|---|---:|---:|---:|---:|---:|---:|---|\n" +
    Array.from(
      { length: 8 },
      (_, i) => `|模型 ${i}|0.95|0.91|0.93|0.92|12000|120 ms|支持中文与长字段的显示|`,
    ).join("\n");
  const long =
    "## 中文与长路径\n\n" +
    "这里是中英文混排 Grok Workbench，测试标点、数字 123 与字体行距。".repeat(16) +
    "\n\n`C:\\project\\" +
    "very-long-directory-".repeat(14) +
    "file.ts`\n\n> 引用块包含 **重点内容**。\n\n- 一级列表\n  - 二级列表\n- [x] 完成事项\n- [ ] 待处理事项";
  async function play() {
    if (playing) return;
    playing = true;
    stream = "";
    for (let i = 1; i <= formula.length; i += 8) {
      stream = formula.slice(0, i);
      await new Promise((r) => setTimeout(r, 20));
    }
    stream = formula;
    playing = false;
  }
</script>

<main
  class="display-lab"
  style={`--reading-size:${size}px;--reading-line-height:1.85;font-size:${size}px`}
>
  <nav>
    <strong>显示场景检查</strong><label
      >内容宽度 <select bind:value={width}
        ><option value={900}>900</option><option value={640}>640</option><option value={460}
          >460</option
        ></select
      ></label
    ><label
      >字号 <select bind:value={size}
        ><option>14</option><option>18</option><option>22</option></select
      ></label
    >
  </nav>
  <div class="samples" style={`width:min(${width}px,100%)`}>
    <section id="formula">
      <h2>01 · 公式</h2>
      <RichText text={formula} />
    </section>
    <section id="wide-math">
      <h2>02 · 宽公式</h2>
      <RichText
        text={"$$" + Array.from({ length: 24 }, (_, i) => `a_{${i}}x^{${i}}`).join("+") + "$$"}
      />
    </section>
    <section id="code">
      <h2>03 · 长代码与复制</h2>
      <RichText text={code} />
    </section>
    <section id="table">
      <h2>04 · 宽表格</h2>
      <RichText text={table} />
    </section>
    <section id="long">
      <h2>05 · 长文本、路径、引用、列表</h2>
      <RichText text={long} />
    </section>
    <section id="stream">
      <h2>06 · 流式公式</h2>
      <button onclick={play} disabled={playing}>播放流式样例</button><RichText text={stream} />
    </section>
    <section id="invalid">
      <h2>07 · 无效与未闭合公式</h2>
      <RichText text={"$$\\frac{1}$$\n\n后续段落仍应可见\n\n\\[\\sum_{i=1}"} />
    </section>
    <section id="thought">
      <h2>08 · 思考折叠</h2>
      <ThoughtBlock text={formula} />
    </section>
    <section id="tools">
      <h2>09 · 执行、失败、修改</h2>
      <ToolCard
        tool={{
          toolCallId: "a",
          title: "执行命令：读取中文目录",
          status: "completed",
          rawOutput: { output: [...new TextEncoder().encode("中文输出\n" + long)] },
        }}
      />
      <ToolCard
        tool={{
          toolCallId: "b",
          title: "工具执行失败",
          status: "failed",
          rawOutput: { message: "文件不存在：C:/project/fixture.txt" },
        }}
      />
      <ToolCard
        tool={{
          toolCallId: "c",
          title: "修改文件",
          status: "completed",
          content: [
            { type: "diff", path: "demo.ts", oldText: "const x = 1;\n", newText: "const x = 2;\n" },
          ],
        }}
      />
    </section>
    <section id="questions">
      <h2>10 · 多题、多选、自定义输入</h2>
      <InteractionCard
        interaction={{
          id: "demo",
          kind: "question",
          questions: [
            {
              question: "这是一条比较长的问题：你希望报告包含哪些内容，并以什么方式说明执行结果？",
              multiSelect: true,
              options: [
                { label: "结果表格", description: "展示准确率和运行时间" },
                { label: "公式与解释", description: "展示模型公式和中文解释" },
              ],
            },
            { question: "补充说明？", options: [] },
          ],
        }}
        respond={async (r) => {
          response = JSON.stringify(r);
        }}
      />
      <pre class="response">{response}</pre>
    </section>
    <section id="plan">
      <h2>11 · 长计划确认</h2>
      <InteractionCard
        interaction={{ id: "plan", kind: "plan", planContent: formula + "\n" + long }}
        respond={async (r) => {
          response = JSON.stringify(r);
        }}
      />
    </section>
  </div>
</main>

<style>
  .display-lab {
    height: calc(100vh - 38px);
    overflow: auto;
    padding: 24px;
    background: #191b1e;
  }
  nav {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 28px;
  }
  .samples {
    margin: auto;
    max-width: 100%;
  }
  section {
    min-width: 0;
    margin-bottom: 36px;
    padding: 20px;
    border: 1px solid #343a3a;
    border-radius: 12px;
  }
  h2 {
    font-size: 15px;
    color: #acbda5;
    margin-bottom: 20px;
  }
  .response {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
