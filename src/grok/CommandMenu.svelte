<script lang="ts">
  import { localCommands, type SlashCommand } from "./commands";
  let {
    text,
    commands,
    connected,
    choose,
  }: {
    text: string;
    commands: SlashCommand[];
    connected: boolean;
    choose: (text: string) => void;
  } = $props();
  const query = $derived(text.trim().slice(1).split(/\s/)[0].toLowerCase());
  const matches = $derived(
    [...localCommands, ...commands.filter((c) => !localCommands.some((l) => l.name === c.name))]
      .filter((c) => c.name.toLowerCase().includes(query))
      .slice(0, 12),
  );
</script>

{#if text.trim().startsWith("/") && !/\s/.test(text.trim())}
  <div class="command-menu" aria-label="斜杠命令">
    <small>{connected ? "当前会话可用命令" : "连接 Grok 后加载目标、工作流及技能命令"}</small>
    {#each matches as command}<button type="button" onclick={() => choose(`/${command.name} `)}
        ><strong>/{command.name}</strong><span>{command.description}</span></button
      >{/each}
  </div>
{/if}

<style>
  .command-menu {
    max-height: 230px;
    overflow: auto;
    border: 1px solid #45515e;
    border-radius: 10px;
    padding: 8px;
    background: #1e252d;
    font-size: 13px;
  }
  small {
    display: block;
    color: #aab9c9;
    padding: 4px;
  }
  button {
    display: flex;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 7px;
    background: transparent;
    color: inherit;
    border: 0;
    cursor: pointer;
  }
  button:hover {
    background: #384451;
  }
  strong {
    min-width: 100px;
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
