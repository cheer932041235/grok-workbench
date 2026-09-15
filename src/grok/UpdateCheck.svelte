<script lang="ts">
  import { version } from "../../package.json";
  import { checkRelease, newer, type Release } from "./updates";
  let { openReleases }: { openReleases: () => Promise<unknown> } = $props();
  let checking = $state(false);
  let release = $state<Release>();
  let error = $state("");
  async function check() {
    if (checking) return;
    checking = true;
    error = "";
    release = undefined;
    try {
      release = await checkRelease();
    } catch (reason) {
      error =
        reason instanceof TypeError
          ? "无法连接 GitHub，请检查网络后重试"
          : reason instanceof Error && reason.name === "TimeoutError"
            ? "查询超时，请检查网络后重试"
            : String(reason instanceof Error ? reason.message : reason);
    } finally {
      checking = false;
    }
  }
  async function open() {
    try {
      await openReleases();
    } catch (reason) {
      error = `无法打开发布页面：${String(reason)}`;
    }
  }
</script>

<section class="update-check" aria-label="应用更新">
  <header><strong>应用更新</strong><span>当前版本 v{version}</span></header>
  <div class="update-actions">
    <button disabled={checking} onclick={check}>{checking ? "正在查询…" : "检查更新"}</button>
    <button onclick={open}
      >{release && newer(release.version, version) ? "前往下载新版 ↗" : "查看发布页面 ↗"}</button
    >
  </div>
  <p role="status" aria-live="polite">
    {#if checking}正在查询 GitHub 上的最新版本…{:else if error}{error}{:else if release}{#if newer(release.version, version)}发现新版本
        v{release.version}{release.preview
          ? "（预览版）"
          : ""}，可前往发布页面下载安装。{:else}当前已是最新版本（包括预览版）。{/if}{:else}点击检查可获取最新版本信息，下载后由你手动安装。{/if}
  </p>
</section>

<style>
  .update-check {
    border-top: 1px solid #3a3e40;
    padding-top: 14px;
    margin-top: 14px;
  }
  header {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  header span {
    color: #a9afb3;
    font-size: 13px;
  }
  .update-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 10px;
  }
  p {
    margin: 10px 0 0;
    line-height: 1.6;
    font-size: 13px;
    color: #bbc7b5;
  }
</style>
