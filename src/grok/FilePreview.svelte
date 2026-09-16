<script lang="ts">
  import { tick } from "svelte";
  import { convertFileSrc, invoke } from "@tauri-apps/api/core";
  import { hljs } from "$lib/utils/hljs-init";
  import { escapeHtml } from "$lib/utils/ansi";
  import RichText from "./RichText.svelte";
  import PanelResize from "./PanelResize.svelte";
  import type { FileTarget } from "./file-links";
  let {
    target,
    cwd,
    onclose,
    width = $bindable(480),
  }: { target: FileTarget; cwd: string; onclose: () => void; width?: number } = $props();
  type Preview = {
    path: string;
    name: string;
    kind: string;
    extension: string;
    content?: string;
    bytes?: number[];
    mime?: string;
    reason?: string;
  };
  let data = $state<Preview>();
  let error = $state("");
  let notice = $state("");
  let loading = $state(true);
  let raw = $state(false);
  let zoom = $state(100);
  let revision = $state(0);
  let windowWidth = $state(1280);
  let content: HTMLDivElement;
  const sourceLines = $derived((data?.content ?? "").split("\n"));
  const largeText = $derived((data?.content?.length ?? 0) > 200000 || sourceLines.length > 10000);
  const markdown = $derived(data?.extension === "md" || data?.extension === "markdown");
  const base = $derived(data?.path.replace(/[\\/][^\\/]*$/, "") ?? cwd);
  const language = $derived(
    (
      {
        rs: "rust",
        py: "python",
        tsx: "typescript",
        jsx: "javascript",
        html: "xml",
        htm: "xml",
        svg: "xml",
        svelte: "xml",
        vue: "xml",
        ps1: "powershell",
        yml: "yaml",
        h: "c",
        hpp: "cpp",
      } as Record<string, string>
    )[data?.extension ?? ""] ??
      data?.extension ??
      "",
  );
  const highlighted = $derived(
    data?.content && data.content.length <= 200000 && hljs.getLanguage(language)
      ? hljs.highlight(data.content, { language }).value
      : escapeHtml(data?.content ?? ""),
  );
  const mediaSrc = $derived(data ? convertFileSrc(data.path) : "");
  let imageSrc = $state("");
  $effect(() => {
    if (!data?.bytes) {
      imageSrc = "";
      return;
    }
    const url = URL.createObjectURL(new Blob([new Uint8Array(data.bytes)], { type: data.mime }));
    imageSrc = url;
    return () => URL.revokeObjectURL(url);
  });
  $effect(() => {
    const selected = target;
    const directory = cwd;
    void revision;
    let active = true;
    loading = true;
    data = undefined;
    error = "";
    notice = "";
    raw = Boolean(selected.line);
    zoom = 100;
    invoke<Preview>("grok_preview_file", { path: selected.path, cwd: directory })
      .then(async (value) => {
        if (!active) return;
        data = value;
        loading = false;
        await tick();
        if (active && selected.line)
          content?.querySelector(".selected-line")?.scrollIntoView({ block: "center" });
      })
      .catch((e) => {
        if (active) {
          error = String(e);
          loading = false;
        }
      });
    return () => {
      active = false;
    };
  });
  async function open(folder: boolean) {
    try {
      await invoke("grok_open_file", { path: data?.path ?? target.path, cwd, folder });
      notice = folder ? "已打开文件夹" : "已交给系统应用打开";
    } catch (e) {
      notice = String(e);
    }
  }
</script>

<svelte:window bind:innerWidth={windowWidth} />
<section
  class="file-preview"
  aria-label="文件预览"
  style:width={`${Math.min(width, windowWidth - (windowWidth > 1300 ? 960 : 460))}px`}
>
  <div class="resize-edge">
    <PanelResize
      side="right"
      {width}
      min={320}
      max={Math.max(320, windowWidth - (windowWidth > 1300 ? 960 : 460))}
      onresize={(value) => (width = value)}
      label="调整文件预览宽度"
    />
  </div>
  <header>
    <strong title={data?.path ?? target.path}
      >{data?.name ?? target.path.split(/[\\/]/).at(-1)}</strong
    ><button aria-label="关闭文件预览" onclick={onclose}>×</button>
  </header>
  <div class="file-path">{data?.path ?? target.path}</div>
  <nav aria-label="预览操作">
    <button onclick={() => revision++} disabled={loading}>刷新</button>
    <button onclick={() => open(false)}>系统打开</button>
    <button onclick={() => open(true)}>打开文件夹</button>
    {#if markdown && data?.kind === "text"}<button onclick={() => (raw = !raw)}
        >{raw ? "阅读视图" : "源码"}</button
      >{/if}
    {#if data?.kind === "image"}<button
        onclick={() => (zoom = Math.max(25, zoom - 25))}
        aria-label="缩小图片">−</button
      ><span>{zoom}%</span><button
        onclick={() => (zoom = Math.min(400, zoom + 25))}
        aria-label="放大图片">＋</button
      >{/if}
  </nav>
  {#if notice}<p role="status">{notice}</p>{/if}
  <div class="file-content" bind:this={content}>
    {#if loading}<p role="status">正在读取文件…</p>
    {:else if error}<p role="alert">{error}</p>
    {:else if data?.kind === "image"}<img src={imageSrc} alt={data.name} style:width={`${zoom}%`} />
    {:else if data?.kind === "pdf"}
      <iframe class="pdf-preview" src={mediaSrc} title={data.name}></iframe>
    {:else if data?.kind === "video"}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        controls
        preload="metadata"
        src={mediaSrc}
        onerror={() => (notice = "此视频编码无法内置播放，可使用系统打开。")}
      ></video>
    {:else if data?.kind === "audio"}
      <audio
        controls
        preload="metadata"
        src={mediaSrc}
        onerror={() => (notice = "此音频编码无法内置播放，可使用系统打开。")}
      ></audio>
    {:else if data?.kind === "text"}
      {#if largeText}<p>内容较多，使用纯文本视图。</p>
        <pre>{data.content}</pre>
      {:else if markdown && !raw}<RichText text={data.content ?? ""} {base} />
      {:else}<div class="source">
          <div class="line-numbers" aria-hidden="true">
            {#each (data.content ?? "").split("\n") as _, i}<div
                class:selected-line={target.line === i + 1}
              >
                {i + 1}
              </div>{/each}
          </div>
          <pre><code class="hljs">{@html highlighted}</code></pre>
        </div>{/if}
    {:else}<p>{data?.reason ?? "此文件类型暂不支持内置预览，可使用系统应用打开。"}</p>{/if}
  </div>
</section>

<style>
  .file-preview {
    position: fixed;
    top: 38px;
    bottom: 0;
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    background: #191c20;
    border-left: 1px solid #444b53;
    box-shadow: -12px 0 36px #0005;
    color: #e1e5e9;
    min-width: 0;
  }
  .resize-edge {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -6px;
    width: 6px;
    display: flex;
  }
  .resize-edge :global(.panel-resize) {
    display: block !important;
    height: 100%;
    width: 6px;
  }
  header {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
  }
  header strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button {
    background: #292e35;
    border: 1px solid #454b54;
    color: inherit;
    border-radius: 6px;
    padding: 5px 9px;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
  }
  .file-path {
    font-size: 12px;
    color: #aeb7c2;
    overflow-wrap: anywhere;
    padding: 0 16px 10px;
  }
  nav {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    padding: 0 16px 12px;
    border-bottom: 1px solid #343b44;
  }
  .file-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 18px;
  }
  p {
    padding: 0 16px;
    overflow-wrap: anywhere;
  }
  img {
    max-width: none;
    height: auto;
    display: block;
  }
  .pdf-preview {
    width: 100%;
    height: 100%;
    min-height: 400px;
    border: 0;
  }
  video,
  audio {
    width: 100%;
    max-height: 100%;
  }
  .source {
    display: flex;
    min-width: max-content;
    font:
      13px/1.65 Consolas,
      monospace;
    tab-size: 4;
  }
  .line-numbers {
    color: #8794a4;
    text-align: right;
    user-select: none;
    padding-right: 14px;
  }
  .selected-line {
    color: #fff;
    background: #496044;
    outline: 1px solid #849b79;
  }
  pre {
    margin: 0;
    font: inherit;
  }
  code {
    font: inherit;
    padding: 0;
    background: transparent;
  }
</style>
