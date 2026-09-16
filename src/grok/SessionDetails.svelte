<script lang="ts">
  import type { Transcript } from "./protocol";
  import RichText from "./RichText.svelte";
  let { transcript }: { transcript: Transcript } = $props();
</script>

{#each [...(transcript.goal ? [transcript.goal] : []), ...(transcript.workflows ?? [])] as run}
  <section class="session-detail" aria-label="目标与工作流状态">
    <strong>{run.sessionUpdate === "goal_updated" ? "自主目标" : "工作流"} · {String(run.status ?? "")}</strong>
    <p>{String(run.objective ?? run.name ?? "")}</p>
    <div>
      阶段：{String(run.phase ?? run.current_phase ?? "—")}{#if typeof run.tokens_used === "number"}
        · 已用 {run.tokens_used.toLocaleString()} tokens{/if}{#if typeof run.token_budget === "number"}
        / {run.token_budget.toLocaleString()}{/if}
    </div>
    {#if run.last_event}<p>{String(run.last_event)} {String(run.last_event_detail ?? "")}</p>{/if}
    {#if run.pause_message}<p>{String(run.pause_message)}</p>{/if}
    {#if run.result_summary}<p>{String(run.result_summary)}</p>{/if}
    <details>
      <summary>完整状态</summary>
      <pre>{JSON.stringify(run, null, 2)}</pre>
    </details>
  </section>
{/each}
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
