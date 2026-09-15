<script lang="ts">
  import { getContext } from "svelte";
  import { filePreviewContext, parseFileLink, type OpenFile } from "./file-links";
  import { renderMarkdown } from "$lib/utils/markdown";
  let { text, base }: { text: string; base?: string } = $props();
  const openFile = getContext<OpenFile | undefined>(filePreviewContext);
  let copied = $state("");
  async function copy(event: MouseEvent) {
    const link = (event.target as HTMLElement).closest<HTMLElement>("[data-local-file]");
    if (link) {
      event.preventDefault();
      const target = parseFileLink(link.dataset.localFile ?? "");
      if (target && openFile) openFile(target, base);
      return;
    }
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
