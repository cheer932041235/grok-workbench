<script lang="ts">
  import "../grok/workbench.css";
  import TitleBar from "../grok/TitleBar.svelte";
  let { children } = $props();
</script>

<TitleBar />
{@render children()}
