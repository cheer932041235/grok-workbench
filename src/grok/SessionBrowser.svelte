<script lang="ts">
  import RichText from "./RichText.svelte";
  import { imageUrl, readImage } from "./images";
  import type { StoredSession } from "./history";
  let {
    record = $bindable(),
    running,
    executionStatus,
    onback,
    oncontinue,
    onsave,
    onchangefolder,
    onreading,
  }: {
    record: StoredSession;
    running: boolean;
    executionStatus: string;
    onback: () => void;
    oncontinue: () => void;
    onsave: () => void;
    onchangefolder: () => void;
    onreading: (value: boolean) => void;
  } = $props();
  let error = $state("");
  let readingImage = $state(false);
  async function paste(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!files.length) return;
    event.preventDefault();
    readingImage = true;
    onreading(true);
    try {
      if ((record.draftImages?.length ?? 0) + files.length > 4)
        throw Error("每条需求最多添加 4 张图片");
      record.draftImages = [
        ...(record.draftImages ?? []),
        ...(await Promise.all(files.map(readImage))),
      ];
      onsave();
    } catch (e) {
      error = String(e);
    } finally {
      readingImage = false;
      onreading(false);
    }
  }
</script>

<section class="session-browser" aria-label="浏览会话">
  <header>
    <strong>{record.sessionId ? record.title : "新会话草稿"}</strong><button onclick={onback}
      >返回执行会话</button
    >
  </header>
  <div class="background-state" role="status">
    {running ? `后台会话：${executionStatus}` : "后台任务已结束，可以继续此会话"}
  </div>
  <div class="browse-content">
    {#each record.blocks as block}
      {#if block.type === "user"}<article class="user-message">
          <small>你的问题</small>
          <p>{block.text}</p>
          {#each block.images ?? [] as img}<img src={imageUrl(img)} alt={img.name} />{/each}
        </article>
      {:else if block.type === "answer"}<article>
          <RichText text={block.text} base={record.cwd} />
        </article>{/if}
    {/each}
    {#if !record.blocks.length}<p>可以先准备下一条需求。草稿会单独保存。</p>{/if}
  </div>
  <div class="browse-composer">
    <div class="browse-directory">
      <span title={record.cwd}>{record.cwd || "尚未选择工作目录"}</span><button
        onclick={onchangefolder}
        disabled={Boolean(record.sessionId)}>选择目录</button
      >
    </div>
    {#if error}<p role="alert">{error}</p>{/if}
    <textarea
      aria-label="浏览会话草稿"
      placeholder="为此会话准备需求，草稿自动保存…"
      bind:value={record.draft}
      oninput={onsave}
      onpaste={paste}
      rows="3"
    ></textarea>
    {#each record.draftImages ?? [] as img, index}<button
        onclick={() => {
          record.draftImages = record.draftImages?.filter((_, i) => i !== index);
          onsave();
        }}>移除图片：{img.name}</button
      >{/each}
    <div class="browse-actions">
      <small>{readingImage ? "正在读取图片…" : "草稿保存在当前会话，不会发给后台任务"}</small
      ><button
        disabled={running || readingImage || record.archived || !record.cwd}
        onclick={oncontinue}>{running ? "等待后台任务结束" : "继续此会话"}</button
      >
    </div>
  </div>
</section>

<style>
  .session-browser {
    grid-column: 3 / -1;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: #191b1e;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 20px;
    border-bottom: 1px solid #34373d;
  }
  header strong {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  button {
    border: 1px solid #454b54;
    border-radius: 6px;
    padding: 6px 10px;
  }
  .background-state {
    padding: 8px 20px;
    color: #bdd0b2;
    font-size: 13px;
  }
  .browse-content {
    flex: 1;
    overflow: auto;
    min-height: 0;
    padding: 20px 5%;
    font-size: var(--reading-size);
    line-height: var(--reading-line-height);
  }
  article {
    margin-bottom: 24px;
  }
  article img {
    max-width: 240px;
  }
  .user-message {
    padding: 16px;
    background: #252e29;
    border-radius: 10px;
  }
  .user-message p {
    white-space: pre-wrap;
  }
  .browse-composer {
    margin: 12px 24px 20px;
    padding: 12px;
    border: 1px solid #454b54;
    border-radius: 12px;
  }
  textarea {
    width: 100%;
    resize: vertical;
    background: transparent;
    border: 0;
    padding: 12px 0;
    outline: none;
  }
  .browse-actions,
  .browse-directory {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
  }
  .browse-directory span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
