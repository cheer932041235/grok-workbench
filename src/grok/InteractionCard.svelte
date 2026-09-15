<script lang="ts">
  import RichText from "./RichText.svelte";
  import { questionResponse, type Interaction } from "./interactions";
  let {
    interaction,
    respond,
  }: {
    interaction: Interaction;
    respond: (result: Record<string, unknown>) => Promise<void>;
  } = $props();
  let selected = $state<string[][]>([]);
  let notes = $state<string[]>([]);
  let feedback = $state("");
  let sending = $state(false);
  let error = $state("");
  const questions = $derived(interaction.questions ?? []);
  const answered = $derived(questions.every((_, i) => selected[i]?.length || notes[i]?.trim()));
  async function submit(result: Record<string, unknown>) {
    if (sending) return;
    sending = true;
    error = "";
    try {
      await respond(result);
    } catch (e) {
      error = String(e);
    } finally {
      sending = false;
    }
  }
  function select(index: number, label: string, multiple: boolean, checked: boolean) {
    selected[index] = multiple
      ? checked
        ? [...(selected[index] ?? []), label]
        : (selected[index] ?? []).filter((v) => v !== label)
      : [label];
  }
</script>

<section
  class="interaction-card"
  aria-label={interaction.kind === "question" ? "Grok 的问题" : "确认执行计划"}
>
  <header>
    <strong>{interaction.kind === "question" ? "Grok 需要你的回答" : "确认执行计划"}</strong>
  </header>
  <div class="interaction-body">
    {#if interaction.kind === "question"}
      {#each questions as question, i}
        <fieldset disabled={sending}>
          <legend>{question.question}{question.multiSelect ? "（可多选）" : ""}</legend>
          {#each question.options as option}
            <label class="question-option">
              <input
                type={question.multiSelect ? "checkbox" : "radio"}
                name={`question-${interaction.id}-${i}`}
                checked={selected[i]?.includes(option.label) ?? false}
                onchange={(event) =>
                  select(i, option.label, !!question.multiSelect, event.currentTarget.checked)}
              />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </label>
            {#if option.preview && selected[i]?.includes(option.label)}<RichText
                text={option.preview}
              />{/if}
          {/each}
          <label class="question-notes"
            >自定义回答或补充说明<textarea rows="2" bind:value={notes[i]}></textarea></label
          >
        </fieldset>
      {/each}
    {:else}
      {#if interaction.planContent}<RichText text={interaction.planContent} />{:else}<p>
          Grok 请求结束计划模式并开始执行，请结合会话中的计划确认。
        </p>{/if}
      <label class="question-notes"
        >修改意见<textarea rows="2" bind:value={feedback} disabled={sending}></textarea></label
      >
    {/if}
  </div>
  {#if error}<p role="alert">{error}</p>{/if}
  <footer>
    {#if interaction.kind === "question"}
      <button
        disabled={sending || !answered}
        onclick={() => submit(questionResponse(questions, selected, notes))}>提交回答</button
      >
      <button disabled={sending} onclick={() => submit({ outcome: "cancelled" })}>取消提问</button>
      {#if interaction.mode === "plan"}<button
          disabled={sending}
          onclick={() => submit({ outcome: "skip_interview" })}>跳过访谈</button
        >{/if}
    {:else}
      <button disabled={sending} onclick={() => submit({ outcome: "approved" })}>批准并执行</button>
      <button
        disabled={sending || !feedback.trim()}
        onclick={() => submit({ outcome: "cancelled", feedback: feedback.trim() })}
        >提交修改意见</button
      >
      <button disabled={sending} onclick={() => submit({ outcome: "abandoned" })}>放弃计划</button>
    {/if}
  </footer>
</section>

<style>
  .interaction-card {
    border: 1px solid var(--border, #424640);
    border-radius: 12px;
    background: #222623;
    margin-bottom: 12px;
  }
  header,
  footer {
    padding: 12px 16px;
  }
  .interaction-body {
    max-height: 42vh;
    overflow: auto;
    padding: 0 16px;
    overflow-wrap: anywhere;
  }
  fieldset {
    border: 0;
    padding: 12px 0;
    min-width: 0;
  }
  legend {
    font-weight: 600;
    line-height: 1.6;
  }
  .question-option {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    cursor: pointer;
  }
  input {
    margin-top: 5px;
    flex-shrink: 0;
  }
  small {
    display: block;
    color: #aeb7b2;
    line-height: 1.5;
  }
  .question-notes {
    display: block;
    margin: 10px 0;
    color: #bdc8c0;
  }
  textarea {
    display: block;
    width: 100%;
    margin-top: 6px;
    background: #191c1a;
    color: inherit;
    border: 1px solid #4c554e;
    border-radius: 6px;
    padding: 8px;
    font: inherit;
  }
  footer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  footer button {
    padding: 8px 12px;
    border: 1px solid #58635b;
    border-radius: 7px;
    background: #303931;
    color: #e3e9e3;
    cursor: pointer;
  }
  footer button:first-child {
    background: #c5d5bb;
    color: #1d291d;
  }
  footer button:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>
