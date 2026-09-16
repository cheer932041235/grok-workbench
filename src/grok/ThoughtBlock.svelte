<script lang="ts">
  import RichText from "./RichText.svelte";
  let {
    text,
    durationMs,
    active = false,
  }: { text: string; durationMs?: number; active?: boolean } = $props();
  let expanded = $state(false);
  $effect(() => {
    expanded = active;
  });
</script>

<details class="thought" bind:open={expanded}>
  <summary
    >✧ {active ? "正在思考" : "思考过程"}
    <span
      >{#if durationMs !== undefined}{(durationMs / 1000).toFixed(1)} 秒 ·
      {/if}{text.length.toLocaleString()} 字符</span
    ></summary
  >
  {#if expanded}<RichText {text} />{/if}
</details>
