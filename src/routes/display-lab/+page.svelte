<script lang="ts">
  const dev = import.meta.env.DEV;
  import DisplayLab from "../../grok/DisplayLab.svelte";
</script>

{#if dev}<DisplayLab />{:else}<p>显示测试页仅在开发环境启用。</p>{/if}
