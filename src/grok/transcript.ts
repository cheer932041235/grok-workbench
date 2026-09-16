import type { SessionRecord, Transcript } from "./protocol";
import { toolText } from "./protocol";

export function finishTools(transcript: Transcript): Transcript {
  return {
    ...transcript,
    blocks: transcript.blocks.map((block) =>
      block.type === "tool" && !["completed", "failed"].includes(block.tool.status ?? "")
        ? { type: "tool", tool: { ...block.tool, status: "interrupted" } }
        : block,
    ),
  };
}

export function exportMarkdown(record: SessionRecord): string {
  return (
    `# ${record.title}\n\n项目：${record.cwd}\n\n` +
    (record.plan.length
      ? `## 本轮执行计划

${record.plan.map((step) => `- [${step.status}] ${step.content}`).join("\n")}

`
      : "") +
    (record.activity ?? [])
      .map(
        (item) => `## ${item.label}

${item.detail}

`,
      )
      .join("") +
    (record.backgroundTasks?.length
      ? `## 后台任务

${JSON.stringify(record.backgroundTasks, null, 2)}

`
      : "") +
    (record.researchContext
      ? `## 本轮附加研究上下文

${record.researchContext}

`
      : "") +
    record.blocks
      .map((block) => {
        if (block.type !== "tool")
          return `## ${block.type === "user" ? "你" : block.type === "thought" ? "思考" : "Grok"}\n\n${block.text}`;
        const tool = block.tool;
        const content = (tool.content ?? [])
          .map((item) => {
            if (item.type === "diff")
              return `文件：${item.path ?? ""}\n\n修改前：\n\n\`\`\`\n${item.oldText ?? ""}\n\`\`\`\n\n修改后：\n\n\`\`\`\n${item.newText ?? ""}\n\`\`\``;
            return item.content?.text ?? item.text ?? "";
          })
          .filter(Boolean)
          .join("\n\n");
        return `## 工具：${tool.title ?? tool.kind ?? "工具调用"}\n\n${content || toolText(tool) || tool.status || ""}`;
      })
      .join("\n\n") +
    (record.subagents ?? [])
      .map(
        (agent) =>
          `\n\n---\n\n${exportMarkdown({
            ...record,
            ...agent.transcript,
            sessionId: agent.id,
            title: `子任务：${agent.description}`,
            subagents: undefined,
          })}\n\n状态：${agent.status}\n\n${agent.output ?? ""}${agent.error ? `\n\n错误：${agent.error}` : ""}`,
      )
      .join("")
  );
}
