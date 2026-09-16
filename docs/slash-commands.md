# 斜杠命令适配

## 发送规则

Grok ACP 根据首个文本块的开头识别斜杠命令。命令原样发送，不在前面附加研究上下文。普通研究需求仍附加论文上下文。

连接后接收 available_commands_update，按当前会话提供的命令和用户技能建立可搜索菜单。未知或当前会话未启用的命令明确报错，不能作为普通需求静默执行。

## 支持范围

- 后端命令：/goal、/workflow、/compact、/loop、记忆、Hooks 等以当前 Grok 发布的列表为准；/goal 的 status、pause、resume、clear 由 Grok 原生处理。
- 技能：支持当前会话发布的技能，包括带 user: 或插件前缀的名字。
- 工作台命令：/new、/clear、/resume、/usage、/export、/model、/help。
- /context 映射为返回模型、工作目录和上下文占用的 /session-info。
- goal_updated、workflow_updated 保存并渲染；历史和导出保留完整状态。压缩、记忆、Hooks、插件、调度反馈记录到执行详情。

## 操作边界

执行中的普通命令按队列顺序处理。要暂停或清除正在执行的目标，先点击停止，再发送 /goal pause 或 /goal clear；输入会保留并提示，不会把控制命令悄悄排在长任务后。
终端界面专用命令不会全部自动映射到桌面功能；未适配项会明确提示。后台阶段失败、暂停或额度限制以 Grok 真实状态显示，命令请求完成不代表目标已经完成。

## 验证

真实 Grok 1.0.25 ACP：/goal 创建、status、pause、clear 均返回；收到真实 goal_updated。测试规划阶段失败进入暂停，原因可显示，未宣称目标执行成功。/workflow runs 和 /session-info 返回正常。
回归测试覆盖命令开头、普通上下文、动态技能、未知命令、绝对路径、目标/工作流事件、历史与导出。
