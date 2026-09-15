<script lang="ts">
  import type { QuestionEntry } from "./conversation-outline";
  let {
    entries,
    active,
    navigate,
  }: { entries: QuestionEntry[]; active: number; navigate: (index: number) => void } = $props();
</script>

<nav class="conversation-outline" aria-label="对话目录">
  <div class="outline-description">点击问题，跳转到对应对话</div>
  {#if entries.length}<ol>
      {#each entries as entry (entry.blockIndex)}<li>
          <button
            class:active={active === entry.blockIndex}
            aria-current={active === entry.blockIndex ? "location" : undefined}
            title={entry.title}
            onclick={() => navigate(entry.blockIndex)}
            ><span class="question-number">{String(entry.number).padStart(2, "0")}</span><span
              class="question-title">{entry.title}</span
            ></button
          >
        </li>{/each}
    </ol>{:else}<p class="outline-empty">发送问题后，这里会按顺序列出每一轮提问。</p>{/if}
</nav>

<style>
  .conversation-outline {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }
  .outline-description,
  .outline-empty {
    color: #9fa9b6;
    font-size: 12px;
    line-height: 1.7;
    padding: 10px 0 16px;
  }
  ol {
    list-style: none;
    padding: 0 5px 12px 0;
    margin: 0;
    overflow-y: auto;
    min-height: 0;
    scrollbar-width: thin;
  }
  li + li {
    margin-top: 7px;
  }
  button {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 11px 9px;
    border: 1px solid transparent;
    border-radius: 8px;
    text-align: left;
    background: transparent;
    color: #c8ced7;
    cursor: pointer;
  }
  button:hover {
    background: #252b31;
  }
  button.active {
    background: #28332d;
    border-color: #546957;
    color: #f0f5ee;
  }
  button:focus-visible {
    outline: 2px solid #b7d1b5;
    outline-offset: 1px;
  }
  .question-number {
    color: #a8c4a6;
    font:
      12px/1.7 Consolas,
      monospace;
    padding-top: 1px;
  }
  .question-title {
    font-size: 13px;
    line-height: 1.65;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
  }
</style>
