<script lang="ts">
  import RichText from "./RichText.svelte";
  let { text }: { text: string } = $props();
  let expanded = $state(false);
</script>

<details class="thought" bind:open={expanded}>
  <summary>✧ 思考过程 <span>{text.length.toLocaleString()} 字符</span></summary>
  {#if expanded}<RichText {text} />{/if}
</details>
