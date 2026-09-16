<script lang="ts">
  import type { Transcript } from "./protocol";
  import RichText from "./RichText.svelte";
  let { transcript }: { transcript: Transcript } = $props();
</script>

{#if transcript.plan.length}<details class="session-detail" open>
    <summary>本轮执行计划</summary>
    <ul>
      {#each transcript.plan as step}<li>
          <span
            >{step.status === "completed"
              ? "✓"
              : step.status === "in_progress"
                ? "进行中"
                : "待办"}</span
          >
          {step.content}
        </li>{/each}
    </ul>
  </details>{/if}
{#if transcript.backgroundTasks?.length}<details class="session-detail">
    <summary>后台任务 · {transcript.backgroundTasks.length}</summary>
    <pre>{JSON.stringify(transcript.backgroundTasks, null, 2)}</pre>
  </details>{/if}
{#each transcript.activity ?? [] as item}<details
    class="session-detail"
    class:failed={item.failed}
    open={item.failed}
  >
    <summary>{item.label}{item.failed ? " · 失败" : ""}</summary>
    <pre>{item.detail}</pre>
  </details>{/each}
{#if transcript.researchContext}<details class="session-detail">
    <summary>本轮附加研究上下文</summary><RichText text={transcript.researchContext} />
  </details>{/if}

<style>
  .session-detail {
    font-size: 13px;
    margin: 8px 0;
    padding: 8px 12px;
    border-left: 2px solid #66766a;
    color: #b6c2ba;
  }
  summary {
    cursor: pointer;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  li {
    margin: 6px 0;
  }
  span {
    color: #a9bea3;
  }
  .failed {
    border-color: #d88878;
    color: #edb3a6;
  }
</style>
