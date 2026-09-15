<script lang="ts">
  let {
    side,
    width,
    min,
    max,
    onresize,
    label,
  }: {
    side: "left" | "right";
    width: number;
    min: number;
    max: number;
    onresize: (width: number, save: boolean) => void;
    label?: string;
  } = $props();
  let dragging = $state(false);
  let startX = 0;
  let startWidth = 0;
  function resize(value: number, save: boolean) {
    onresize(Math.round(Math.max(min, Math.min(max, value))), save);
  }
  function begin(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    startX = event.clientX;
    startWidth = width;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging = true;
  }
  function move(event: PointerEvent) {
    if (dragging) resize(startWidth + (event.clientX - startX) * (side === "left" ? 1 : -1), false);
  }
  function finish() {
    if (dragging) {
      dragging = false;
      resize(width, true);
    }
  }
  function key(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    event.preventDefault();
    resize(
      event.key === "Home"
        ? 252
        : width + (event.key === "ArrowRight" ? 16 : -16) * (side === "left" ? 1 : -1),
      true,
    );
  }
</script>

<!-- Resizable separators are focusable controls in the ARIA window-splitter pattern. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="panel-resize"
  class:dragging
  class:right-resize={side === "right"}
  role="separator"
  tabindex="0"
  aria-orientation="vertical"
  aria-label={label ?? (side === "left" ? "调整会话侧栏宽度" : "调整任务概览宽度")}
  aria-valuenow={width}
  aria-valuemin={min}
  aria-valuemax={max}
  title="拖动调整宽度 · 双击恢复默认 · 方向键微调"
  onpointerdown={begin}
  onpointermove={move}
  onpointerup={finish}
  onpointercancel={finish}
  onlostpointercapture={finish}
  onkeydown={key}
  ondblclick={() => resize(252, true)}
></div>
