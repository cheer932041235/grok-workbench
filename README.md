# Grok Workbench

为 Grok Build 设计的桌面工作台，让回答、公式、工具执行和历史对话更容易阅读与管理。

**当前版本：0.1.0，早期预览。** 已在 Windows 上联调 Grok Build 1.0.25。本仓库提供源码；Grok CLI 需要单独安装并登录。

## 日常使用

选择项目文件夹，发送需求，即可在同一个窗口查看 Grok 的回答和执行过程。Grok 回答时仍然可以输入下一条需求，后续需求会按顺序执行。

| 功能 | 使用方式 |
| --- | --- |
| 图片输入 | 点击“＋ 图片”或在输入框粘贴截图；支持预览、移除、随需求排队和历史回看 |
| 流式阅读 | Markdown、代码高亮、表格和公式随输出更新；支持折叠思考过程与工具详情 |
| 数学公式 | 支持行内与独立公式、矩阵、多行对齐，支持复制 LaTeX 源码 |
| 连续排队 | 编辑、删除、上移待执行需求；暂停或继续队列 |
| 历史管理 | 左侧显示未归档会话；支持搜索、重命名、归档、查看归档和恢复 |
| 设置预选 | 回答期间可以选择模型、思考强度和授权模式，从下一条需求开始生效 |
| Grok 交互 | 展示工具授权、提问选项和计划确认，提交后继续执行 |
| 阅读布局 | 调整字号、行距、两侧面板宽度；切换专注模式与回答/工具筛选 |
| 本地记录 | 保存会话与草稿，导出 Markdown；重启后恢复的队列保持暂停 |

### 公式怎样流式显示？

支持 `\(...\)`、`\[...\]`、`$...$` 和 `$$...$$`。单个公式收到结束符后就会排版，无需等待整轮回答完成；未闭合公式暂时显示源码。代码块中的公式符号保持原样，宽公式和长代码在各自区域内滚动。

### 对话怎样归档？

在左侧对话下点击“归档”，它会移入“已归档”，正文和草稿继续保留。点击“恢复”可移回“进行中”。打开归档会话继续发送需求时，也会恢复为未归档会话。

目前管理的是工作台保存的历史，尚未提供独立 Grok 终端历史的导入入口。

### 图片怎样发送？

点击输入区的“＋ 图片”选择文件，或直接粘贴剪贴板截图，再输入需求并发送。支持 PNG、JPEG、WebP，每条最多 4 张、每张最多 5 MB。图片随对应的排队需求发送，已发送图片保存在本地会话中。

已有会话会保存未发送图片草稿；尚未建立会话时，图片草稿暂不跨重启保存。Markdown 导出目前导出文字，图片请在应用历史中查看。

## 从源码运行

### 环境准备

- Node.js 20 或更新版本；本地验证使用 Node.js 22。
- Rust stable 与 Cargo。
- [Tauri 2 平台依赖](https://v2.tauri.app/start/prerequisites/)。Windows 需要 C++ 构建工具和 WebView2。
- 按 [Grok Build 官方说明](https://github.com/xai-org/grok-build#installing-the-released-binary) 安装 CLI，在终端运行 `grok` 完成登录，确认 `grok --version` 能正常输出版本。

### 启动桌面开发版

```sh
git clone https://github.com/cheer932041235/grok-workbench.git
cd grok-workbench
npm ci --ignore-scripts
npm run tauri -- dev
```

打开应用后：

1. 选择要工作的项目文件夹。
2. 如未找到 Grok，在“连接与显示设置”中填写 `grok.exe` 的完整路径。
3. 选择授权模式，发送第一条需求。

默认是“完全允许”，Grok 可以在所选工作目录执行命令、修改文件。需要逐项确认时，改为“默认授权”。模型与思考强度选项由实际连接的 CLI 返回。

### 构建 Windows 可执行程序

```sh
npm run tauri -- build --no-bundle
```

输出：`src-tauri/target/release/GrokWorkbench.exe`。

桌面程序使用 Rust 与系统 WebView2，运行工作台本身不需要 Node.js 服务。Node.js 用于前端开发和构建；Grok 的 MCP 工具可能有各自的运行时要求。Grok CLI 和 WebView2 不包含在上述 EXE 内。

## 架构

```text
Svelte 5 + TypeScript
  回答渲染 · 消息队列 · 历史管理 · 交互卡片
            │ Tauri commands / events
Tauri 2 + Rust
  CLI 进程生命周期 · 标准输入输出桥接 · 本地记录
            │ ACP / JSON-RPC over stdio
Grok Build CLI
  模型调用 · 工具执行 · 登录与账户配置
```

工作台连接本机 CLI，使用 `grok --permission-mode <mode> agent stdio` 通信。模型请求和工具执行由 Grok CLI 负责。会话保存在应用数据目录的 `sessions/` 下，不保存在本仓库。

主要源码：

- `src/routes/+page.svelte`：会话、队列、历史列表与设置。
- `src/grok/`：ACP 客户端、消息处理、公式、工具与交互组件及测试。
- `src/lib/utils/markdown.ts`：Markdown 渲染。
- `src-tauri/src/grok.rs`：Rust 进程桥接和本地存储。

## 开发与测试

```sh
npm run check
npm run lint
npm test
npm run build
npm run rust:check
```

运行 `npm run dev` 后，可打开 `http://localhost:1420/display-lab` 查看公式、长代码、宽表格、提问卡片和流式样例。测试页仅开发环境启用；连接真实 CLI 请使用桌面开发版。

Windows 实际联调覆盖了：Grok 提问回传、计划批准、连续需求排队、流式公式、输出期间设置预选，以及历史重命名、归档、刷新和恢复。更多信息见 [测试范围](docs/testing.md)。

## 当前边界

- 同时执行一个会话；回答中可以排队，暂不支持多个会话并行运行。
- 历史全文仍一次加载，数百轮长会话的性能尚未验证。
- 单个历史文件无法解析时可能影响列表加载；首次连接失败后的需求恢复仍需完善。
- 暂未提供文件树、通用文件附件、Mermaid 渲染和 Grok 终端历史导入。
- macOS、Linux 和多显示器不同 DPI 的行为尚未完成实测。

## 反馈与贡献

欢迎通过 [Issues](https://github.com/cheer932041235/grok-workbench/issues) 提交问题。请附系统版本、Grok CLI 版本、复现步骤，以及移除个人信息后的截图或错误文本。涉及显示问题时，请提供触发问题的 Markdown 示例。

作者与维护者：[疏锦行](https://github.com/cheer932041235)。
