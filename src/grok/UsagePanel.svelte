<script lang="ts">
  import { parseBilling, type BillingInfo } from "./billing";
  let { executable }: { executable: string } = $props();
  let info = $state<BillingInfo>();
  let error = $state("");
  let updated = $state("");
  let loading = $state(false);
  let refresh = $state(0);
  $effect(() => {
    const command = executable;
    void refresh;
    let disposed = false,
      pending = false;
    info = undefined;
    error = "";
    updated = "";
    async function read() {
      if (pending || document.hidden) return;
      pending = true;
      loading = true;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const value = parseBilling(
          await invoke<Record<string, unknown>>("grok_billing", { executable: command }),
        );
        if (!disposed) {
          info = value;
          error = "";
          updated = new Date().toLocaleTimeString("zh-CN");
        }
      } catch (e) {
        if (!disposed) error = String(e);
      } finally {
        pending = false;
        if (!disposed) loading = false;
      }
    }
    void read();
    const timer = setInterval(() => void read(), 5 * 60 * 1000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  });
</script>

<div class="usage-panel" aria-label="Grok 账号额度">
  <div class="balance">
    {#if info}
      <div class="headline">
        <strong
          >{info.label}{#if info.tier}
            · {info.tier}{/if}</strong
        ><span>已用 {info.used}%</span>
      </div>
      <progress max="100" value={info.used} aria-label={`${info.label}已用百分比`}></progress>
      <small
        >{#if info.reset}重置：{new Date(info.reset).toLocaleString("zh-CN", {
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}{/if} · 每 5 分钟刷新{#if updated}
          · {updated}{/if}</small
      >
    {:else if !error}<span>{loading ? "正在读取账号额度…" : "账号额度"}</span>{/if}
    {#if error}<span role="status"
        >{error}{#if info}（显示上次结果）{/if}</span
      >{/if}
  </div>
  <button disabled={loading} onclick={() => refresh++} aria-label="刷新账号额度"
    >{loading ? "读取中…" : "刷新"}</button
  >
</div>

<style>
  .usage-panel {
    max-width: 940px;
    margin: 0 auto 8px;
    display: flex;
    gap: 16px;
    align-items: center;
    font-size: 12px;
    color: #a9b8d1;
  }
  .balance {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .headline {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    justify-content: space-between;
  }
  strong {
    font-weight: 500;
    color: #d5dff0;
  }
  progress {
    width: 100%;
    height: 5px;
    border: 0;
    border-radius: 4px;
    overflow: hidden;
    accent-color: #9ead98;
  }
  progress::-webkit-progress-bar {
    background: #30373e;
  }
  progress::-webkit-progress-value {
    background: #a8bda0;
  }
  small {
    font-size: 11px;
    color: #98a3b1;
  }
  button {
    flex-shrink: 0;
    font-size: 12px;
  }
  [role="status"] {
    color: #e6b6a1;
    overflow-wrap: anywhere;
  }
</style>
