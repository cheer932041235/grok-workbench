<script lang="ts">
  import { getContext } from "svelte";
  import { filePreviewContext, type OpenFile } from "./file-links";
  const openFile = getContext<OpenFile | undefined>(filePreviewContext);
  import { diffLines } from "diff";
  import { toolText, toolStatus, type Tool } from "./protocol";
  let { tool }: { tool: Tool } = $props();
  let output = $derived(toolText(tool));
  let diffs = $derived((tool.content ?? []).filter((item) => item.type === "diff"));
  let expanded = $state(false);
  $effect(() => {
    if (tool.status === "failed") expanded = true;
  });
</script>

<details class="tool-card" class:compact={!expanded} bind:open={expanded}>
  <summary>
    <span class="tool-icon"
      >{tool.kind === "edit" ? "±" : tool.kind === "execute" ? ">_" : "↗"}</span
    >
    <span class="tool-title">{tool.title || tool.kind || "工具调用"}</span>
    <span
      class:failed={tool.status === "failed"}
      class:working={tool.status === "in_progress"}
      class="tool-status">{toolStatus(tool.status)}</span
    >
  </summary>
  {#if expanded}<div class="tool-body">
      {#if tool.locations?.length}<div class="tool-paths">
          {#each tool.locations as location}<button
              class="file-link"
              onclick={() => openFile?.({ path: location.path, line: location.line })}
              >{location.path}{location.line ? `:${location.line}` : ""}</button
            >{/each}
        </div>{/if}
      {#if tool.rawInput}<details class="raw">
          <summary>调用参数</summary>
          <pre>{JSON.stringify(tool.rawInput, null, 2)}</pre>
        </details>{/if}
      {#if output}<pre class="tool-output">{output}</pre>{/if}
      {#each diffs as change}
        <div class="diff">
          <div class="diff-path">
            {#if change.path}<button
                class="file-link"
                onclick={() => openFile?.({ path: change.path! })}>{change.path}</button
              >{:else}文件修改{/if}
          </div>
          {#each diffLines(change.oldText ?? "", change.newText ?? "") as part}<pre
              class:added={part.added}
              class:removed={part.removed}>{part.added
                ? "+ "
                : part.removed
                  ? "− "
                  : "  "}{part.value}</pre>{/each}
        </div>
      {/each}
      {#if !output && !diffs.length && tool.rawOutput}<pre class="tool-output">{JSON.stringify(
            tool.rawOutput,
            null,
            2,
          )}</pre>{/if}
      {#if !output && !diffs.length && !tool.rawOutput}<p class="muted">
          {tool.status === "completed"
            ? "执行完成"
            : tool.status === "interrupted"
              ? "本轮已中断，未收到工具输出"
              : tool.status === "failed"
                ? "执行失败，未返回详细信息"
                : "等待工具输出…"}
        </p>{/if}
    </div>{/if}
</details>

<style>
  .tool-card.compact {
    background: transparent;
    border-color: transparent;
    margin: 3px 0;
  }
  .tool-card.compact > summary {
    padding: 5px 8px;
  }
</style>
