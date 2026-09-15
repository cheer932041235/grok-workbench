<script lang="ts">
  import { onMount } from "svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  let maximized = $state(false);
  let error = $state("");
  async function action(kind: "minimize" | "toggleMaximize" | "close") {
    if (!isTauri()) return;
    try {
      await getCurrentWindow()[kind]();
    } catch (e) {
      error = String(e);
    }
  }
  onMount(() => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const update = async () => {
      maximized = await window.isMaximized();
    };
    void (async () => {
      await update();
      const stop = await window.onResized(() => {
        void update().catch((e) => {
          error = String(e);
        });
      });
      if (disposed) stop();
      else unlisten = stop;
    })().catch((e) => {
      error = String(e);
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  });
</script>

<div class="titlebar">
  <div class="window-drag" data-tauri-drag-region>
    <span class="window-mark">╱</span><span>Grok Workbench</span>
  </div>
  {#if error}<span class="window-error" role="alert">{error}</span>{/if}
  <div class="window-controls">
    <button aria-label="最小化窗口" title="最小化" onclick={() => action("minimize")}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10" /></svg>
    </button>
    <button
      aria-label={maximized ? "还原窗口" : "最大化窗口"}
      title={maximized ? "还原" : "最大化"}
      onclick={() => action("toggleMaximize")}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        {#if maximized}<path d="M4 3V1h7v7H9M1 4h7v7H1z" />{:else}<path d="M1.5 1.5h9v9h-9z" />{/if}
      </svg>
    </button>
    <button class="window-close" aria-label="关闭窗口" title="关闭" onclick={() => action("close")}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
        ><path d="m1 1 10 10M11 1 1 11" /></svg
      >
    </button>
  </div>
</div>

<style>
  .titlebar {
    height: 38px;
    display: flex;
    align-items: center;
    background: #141518;
    color: #aeb4bb;
    user-select: none;
    font-size: 12px;
  }
  .window-drag {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding-left: 18px;
  }
  .window-drag span {
    pointer-events: none;
  }
  .window-mark {
    font-size: 20px;
    color: #d2d9cf;
  }
  .window-controls {
    display: flex;
    height: 100%;
  }
  .window-controls button {
    width: 46px;
    display: grid;
    place-items: center;
    border-radius: 0;
  }
  .window-controls svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
  }
  .window-controls .window-close:hover {
    background: #c42b35;
    color: white;
  }
  .window-controls button:focus-visible {
    outline-offset: -3px;
  }
  .window-error {
    max-width: 45vw;
    overflow: hidden;
    font-size: 11px;
    color: #efb4b4;
  }
</style>
