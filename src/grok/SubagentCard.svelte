<script lang="ts">
  import type { Subagent } from "./protocol";
  import { toolStatus } from "./protocol";
  import RichText from "./RichText.svelte";
  import ToolCard from "./ToolCard.svelte";
  import ThoughtBlock from "./ThoughtBlock.svelte";
  let {
    agent,
    canManage = false,
    manage,
  }: {
    agent: Subagent;
    canManage?: boolean;
    manage?: (action: "refresh" | "cancel") => Promise<string>;
  } = $props();
  let working = $state(false);
  let feedback = $state("");
  async function act(action: "refresh" | "cancel") {
    if (!manage || working || !canManage) return;
    working = true;
    feedback = "";
    try {
      feedback = await manage(action);
    } catch (e) {
      feedback = e instanceof Error ? e.message : String(e);
    } finally {
      working = false;
    }
  }
</script>

<details class="tool-card subagent-card">
  <summary>
    <span class="tool-icon">⋈</span>
    <span class="tool-title">子任务 · {agent.description}</span>
    <span class="tool-status"
      >{agent.status === "unknown"
        ? "待确认状态"
        : agent.status === "cancelled"
          ? "已取消"
          : toolStatus(agent.status)}</span
    >
  </summary>
  <div class="tool-body">
    {#if manage}<div class="subagent-actions">
        <button disabled={!canManage || working} onclick={() => act("refresh")}
          >{working ? "正在处理…" : "刷新状态"}</button
        >
        <button
          disabled={!canManage ||
            working ||
            ["completed", "failed", "cancelled"].includes(agent.status)}
          onclick={() => act("cancel")}>取消子任务</button
        >
        {#if !canManage}<small class="muted">连接会话后可管理当前进程中的子任务</small>{/if}
      </div>{/if}
    {#if feedback}<p role="status">{feedback}</p>{/if}
    <p class="muted">
      {agent.agentType} · {agent.turns ?? 0} 轮 · {agent.toolCalls ?? 0} 次工具调用{agent.durationMs !=
      null
        ? ` · ${Math.round(agent.durationMs / 1000)} 秒`
        : ""}
    </p>
    {#if agent.status === "unknown"}<p class="muted">
        这是保存时的子任务记录，当前运行状态尚未确认。
      </p>{/if}
    {#if agent.transcript.plan.length}<h4>子任务计划</h4>
      <ul>
        {#each agent.transcript.plan as entry}<li>{entry.content} · {entry.status}</li>{/each}
      </ul>{/if}
    {#each agent.transcript.blocks as block}
      {#if block.type === "tool"}<ToolCard tool={block.tool} />
      {:else if block.type === "thought"}<ThoughtBlock text={block.text} />
      {:else}<RichText text={block.text} />{/if}
    {/each}
    {#if agent.output}<h4>任务结果</h4>
      <RichText text={agent.output} />{/if}
    {#if agent.error}<p class="failed">{agent.error}</p>{/if}
  </div>
</details>
