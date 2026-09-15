# 开发指南

[返回首页](../README.md) · [架构说明](architecture.md) · [贡献指南](../CONTRIBUTING.md)

## 环境

Node.js 20+（本地验证使用 22）、Rust stable，以及 [Tauri 2 平台依赖](https://v2.tauri.app/start/prerequisites/)。Windows 需要 C++ 构建工具和 WebView2。真实联调需要安装并登录 Grok CLI。

```sh
npm ci --ignore-scripts
npm run tauri -- dev
```

只检查显示时运行 `npm run dev`，打开 `http://localhost:1420/display-lab`。该页面复用真实组件，可调整宽度、字号并播放流式样例；它仅在开发环境启用。连接 CLI 必须使用桌面版。

## 文件放在哪里

```text
.github/                   Issue、PR 模板与自动检查
docs/                      使用、开发、架构、测试与改进方向
  images/                  README 使用的界面截图
src/
  routes/                  页面入口和工作台协调逻辑
  grok/                    协议、队列、图片、渲染与交互组件
    *.test.ts              与模块就近维护的测试
  lib/utils/               Markdown 渲染所需的共享工具
src-tauri/
  src/                     Rust 进程桥接与本地存储
  capabilities/            桌面窗口与命令权限配置
  icons/                   应用图标资源
static/                    静态资源
```

新增页面放 `src/routes/`，Grok 业务模块和组件放 `src/grok/`，Rust 文件操作和进程能力放 `src-tauri/src/`。文档截图放 `docs/images/`；个人对话、日志、安装包和构建产物不提交到源码目录。

不要仅为改变目录外观移动代码。模块边界调整应围绕实际职责，同时更新引用和相关测试。

## 检查

| 命令 | 作用 |
| --- | --- |
| `npm run check` | Svelte 与 TypeScript 检查 |
| `npm run lint` | 前端代码规范 |
| `npm run format:check` | 格式检查 |
| `npm test` | 协议、队列、图片、公式等单元测试 |
| `npm run build` | 生产前端构建 |
| `npm run rust:check` | Rust 格式与 Clippy |
| `npm run verify` | 以上检查的完整组合 |

提交代码时，自动检查在 Windows 上运行前端检查与 Rust 检查。它不替代真实 CLI 联调、桌面视觉检查或安装测试。具体覆盖范围见 [测试说明](testing.md)。

## 打包 Windows

```sh
npm run tauri -- build --no-bundle
npm run tauri -- build --bundles nsis
```

默认输出分别在 `src-tauri/target/release/GrokWorkbench.exe` 与 `src-tauri/target/release/bundle/nsis/`。安装包放 GitHub Releases，源码中不提交二进制构建产物。

准备新版本时同步 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 和相关客户端版本信息，更新 [CHANGELOG](../CHANGELOG.md)，从对应版本构建并验证安装、启动、历史恢复和 CLI 往返。当前版本信息仍分布在多个文件中。
