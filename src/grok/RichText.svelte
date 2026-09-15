<script lang="ts">
  import { renderMarkdown } from "$lib/utils/markdown";
  let { text }: { text: string } = $props();
  let copied = $state("");
  async function copy(event: MouseEvent) {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-code-copy], [data-math-copy]",
    );
    if (!target) return;
    const text =
      target.getAttribute("data-math-copy") ??
      target.closest(".code-block")?.querySelector("code")?.textContent;
    if (text != null) {
      try {
        await navigator.clipboard.writeText(text);
        copied = target.hasAttribute("data-math-copy") ? "公式源码已复制" : "代码已复制";
      } catch {
        copied = "复制失败，请手动选择内容复制";
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="rich-text" onclick={copy}>{@html renderMarkdown(text)}</div>
{#if copied}<small class="muted" role="status">{copied}</small>{/if}
