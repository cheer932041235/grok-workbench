export interface SlashCommand {
  name: string;
  description: string;
  input?: { hint?: string };
}
export function slashCommand(text: string) {
  const match = text.trim().match(/^\/([^\s/\\]+)(?:\s+([\s\S]*))?$/);
  return match ? { name: match[1], args: match[2]?.trim() ?? "" } : undefined;
}
export function promptText(text: string, context = "") {
  // Grok's ACP parser requires the slash command in the first text block, at its start.
  return slashCommand(text) || !context ? text : `${context}\n\n## 本轮用户需求\n${text}`;
}
export function remoteCommand(text: string, commands: SlashCommand[]) {
  const command = slashCommand(text);
  if (!command) return text;
  const aliases: Record<string, string> = { yolo: "always-approve", context: "session-info" };
  const name = aliases[command.name] ?? command.name;
  if (!commands.some((c) => c.name === name))
    throw Error(
      `当前 Grok 会话未提供 /${command.name}。输入 / 查看可用命令；终端界面专用命令需要在 CLI 中使用。`,
    );
  return `/${name}${command.args ? ` ${command.args}` : ""}`;
}
export const localCommands: SlashCommand[] = [
  { name: "help", description: "查看工作台和当前 Grok 可用命令" },
  { name: "new", description: "开启空白对话，保留历史" },
  { name: "clear", description: "重置聊天上下文，保留历史" },
  { name: "resume", description: "打开历史会话列表" },
  { name: "usage", description: "刷新并查看账号周额度" },
  { name: "export", description: "导出当前会话" },
  { name: "model", description: "显示或设置模型 /model <模型名>" },
];
