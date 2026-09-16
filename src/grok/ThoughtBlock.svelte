<script lang="ts">
  import RichText from "./RichText.svelte";
  let {
    text,
    durationMs,
    active = false,
  }: { text: string; durationMs?: number; active?: boolean } = $props();
</script>

<section class="thought" aria-label="思考过程">
  <header
    >✧ {active ? "正在思考" : "思考过程"}
    <span
      >{#if durationMs !== undefined}{(durationMs / 1000).toFixed(1)} 秒 ·
      {/if}{text.length.toLocaleString()} 字符</span
    ></header
  >
  <RichText {text} />
</section>
