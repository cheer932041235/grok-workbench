<script lang="ts">
  import { onMount, tick } from "svelte";
  import { invoke, isTauri } from "@tauri-apps/api/core";
  import { open, save } from "@tauri-apps/plugin-dialog";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { finishTools, exportMarkdown } from "../grok/transcript";
  import { GrokClient } from "../grok/client";
  import { PromptQueue, type QueueView } from "../grok/queue";
  import {
    type Transcript,
    type SessionRecord,
    type Permission,
    type RpcMessage,
    type ConfigOption,
  } from "../grok/protocol";
  import RichText from "../grok/RichText.svelte";
  import { readImage, imageUrl, imageContent, type PromptImage } from "../grok/images";
  import ToolCard from "../grok/ToolCard.svelte";
  import SubagentCard from "../grok/SubagentCard.svelte";
  import { refreshSubagent, cancelSubagent } from "../grok/subagent-management";
  import {
    historySummary,
    materializeHistory,
    type HistorySummary,
    type StoredSession,
  } from "../grok/history";
  import { SessionSaver } from "../grok/persistence";
  import { applySessionEvent, restoreSubagents, sessionMethods } from "../grok/session-events";
  import ThoughtBlock from "../grok/ThoughtBlock.svelte";
  import PanelResize from "../grok/PanelResize.svelte";
  import InteractionCard from "../grok/InteractionCard.svelte";
  import type { Interaction, Question } from "../grok/interactions";

  let windowWidth = $state(1280);
  let leftWidth = $state(252);
  let rightWidth = $state(252);
  const showInspector = $derived(windowWidth > 1200);
  const displayedRight = $derived(
    Math.min(rightWidth, Math.max(200, windowWidth - 460 - 220 - 12)),
  );
  const leftMax = $derived(
    Math.min(480, windowWidth - 460 - (showInspector ? displayedRight + 12 : 6)),
  );
  const displayedLeft = $derived(Math.min(leftWidth, Math.max(220, leftMax)));
  const rightMax = $derived(Math.min(480, windowWidth - 460 - displayedLeft - 12));
  function resizePanel(side: "left" | "right", value: number, save: boolean) {
    if (side === "left") leftWidth = value;
    else rightWidth = value;
    if (save) localStorage.setItem(`grok-workbench.${side}Width`, String(value));
  }

  let cwd = $state("");
  let executable = $state("grok");
  let version = $state("");
  let prompt = $state("");
  let draftImages = $state<PromptImage[]>([]);
  let unsentPrompt = $state<{ text: string; images: PromptImage[] } | undefined>();
  let imageLoading = $state(false);
  let imageInput: HTMLInputElement;
  async function addImages(files: File[]) {
    if (imageLoading || switching || closing || managing) return;
    imageLoading = true;
    try {
      if (draftImages.length + files.length > 4) throw new Error("每条需求最多添加 4 张图片");
      const images = await Promise.all(files.map(readImage));
      draftImages = [...draftImages, ...images];
      await persist();
    } catch (e) {
      report(e);
    } finally {
      imageLoading = false;
    }
  }
  function pasteImages(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (files.length) {
      event.preventDefault();
      void addImages(files);
    }
  }
  let sessionId = $state("");
  let title = $state("新会话");
  let transcript = $state<Transcript>({ blocks: [], plan: [] });
  let history = $state<HistorySummary[]>([]);
  let recordSource = $state<string | undefined>();
  let archived = $state(false);
  let showArchived = $state(false);
  let renamingId = $state("");
  let renameText = $state("");
  let managing = $state(false);
  let permissions = $state<Permission[]>([]);
  let interactions = $state<Interaction[]>([]);
  let options = $state<ConfigOption[]>([]);
  let status = $state("未连接");
  let ready = $state(false);
  let queueView = $state<QueueView>({ pending: [], running: false, paused: false });
  let busy = $derived(queueView.running);
  let editingQueueId = $state<number | null>(null);
  let queuedEdit = $state("");
  let closing = $state(false);
  const messageQueue = new PromptQueue(executePrompt, (view) => {
    queueView = view;
    changed();
  });
  let connecting = $state(false);
  let stopping = $state(false);
  let error = $state("");
  let settings = $state(false);
  let search = $state("");
  let filter = $state("all");
  let fontSize = $state(18);
  let lineHeight = $state(1.85);
  let focusMode = $state(false);
  let permissionMode = $state("bypassPermissions");
  let activePermissionMode = $state("");
  let pendingConfig = $state<Record<string, string>>({});
  const hasPendingConfig = $derived(
    Object.keys(pendingConfig).length > 0 || (ready && activePermissionMode !== permissionMode),
  );
  const permissionModes = [
    { value: "bypassPermissions", name: "完全允许" },
    { value: "acceptEdits", name: "自动接受编辑" },
    { value: "auto", name: "自动判断" },
    { value: "default", name: "默认授权" },
    { value: "dontAsk", name: "不询问（受限操作拒绝）" },
    { value: "plan", name: "计划模式" },
  ];
  function saveDisplay() {
    localStorage.setItem("grok-workbench.lineHeight", String(lineHeight));
    localStorage.setItem("grok-workbench.focusMode", String(focusMode));
  }
  async function changePermission(value: string) {
    if (busy) {
      permissionMode = value;
      localStorage.setItem("grok-workbench.permissionMode", value);
      notice = "授权模式已选好，从下一条需求开始生效";
      return;
    }
    configChanging = true;
    try {
      if (ready) await disconnect();
      permissionMode = value;
      localStorage.setItem("grok-workbench.permissionMode", value);
      notice = "授权模式已保存，下次发送时生效";
    } catch (e) {
      report(e);
    } finally {
      configChanging = false;
    }
  }
  let projectPath = $state("");
  let notice = $state("");
  let configChanging = $state(false);
  let switching = $state(false);
  let follow = $state(true);
  let viewport: HTMLDivElement;
  let diagnostics = $state<string[]>([]);
  let mounted = $state(false);
  let replaying = false;
  let client: GrokClient;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saveQueue = Promise.resolve();
  let canLoad = false;
  let connection: Promise<void> | undefined;
  let visibleBlocks = $derived(
    transcript.blocks.filter(
      (b) =>
        filter === "all" ||
        (filter === "answers" ? b.type === "answer" || b.type === "user" : b.type === "tool"),
    ),
  );
  let tools = $derived(transcript.blocks.filter((b) => b.type === "tool"));
  let completed = $derived(
    tools.filter((b) => b.type === "tool" && b.tool.status === "completed").length,
  );
  let visibleHistory = $derived(
    history.filter(
      (h) =>
        Boolean(h.archived) === showArchived &&
        `${h.title} ${h.cwd}`.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  let projectName = $derived(cwd.split(/[\\/]/).filter(Boolean).at(-1) || "选择项目文件夹");

  function report(value: unknown) {
    error = value instanceof Error ? value.message : String(value);
  }
  function log(text: string) {
    diagnostics = [...diagnostics.slice(-79), text];
  }
  function record(): StoredSession {
    return {
      sessionId,
      source: recordSource,
      archived,
      title,
      cwd,
      updatedAt: new Date().toISOString(),
      ...transcript,
      queuedPrompts: queueView.pending.map(({ text, images }) => ({ text, images })),
      draft: prompt,
      draftImages: [...draftImages],
      pendingConfig: { ...pendingConfig },
    };
  }
  function persist() {
    if (!mounted) return Promise.resolve();
    localStorage.setItem("grok-workbench.activeSession", sessionId);
    if (!sessionId) {
      localStorage.setItem("grok-workbench.newDraft", prompt);
      const draft = { text: prompt, images: [...draftImages], unsentPrompt };
      saveQueue = saveQueue.catch(() => {}).then(() => invoke<void>("grok_save_draft", { draft }));
      return saveQueue;
    }
    const snapshot = JSON.parse(JSON.stringify(record())) as StoredSession;
    return saveQueue.then(() => sessionSaver.save(snapshot));
  }
  const sessionSaver = new SessionSaver(
    async (snapshot) => {
      await invoke("grok_save", { record: snapshot });
    },
    (snapshot) => {
      const summary = historySummary(snapshot);
      history = [summary, ...history.filter((h) => h.sessionId !== summary.sessionId)].sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      );
    },
  );
  async function readSession(id: string): Promise<StoredSession> {
    const raw = await invoke<StoredSession>("grok_load", { sessionId: id });
    const saved = materializeHistory(raw);
    if (raw.importedEvents) await invoke("grok_save", { record: saved });
    return saved;
  }
  async function importHistory() {
    if (
      !mounted ||
      busy ||
      connecting ||
      switching ||
      managing ||
      configChanging ||
      closing ||
      imageLoading
    )
      return;
    managing = true;
    notice = "正在导入 Grok 历史…";
    try {
      await persist();
      const result = await invoke<{ imported: number; skipped: number; warnings: string[] }>(
        "grok_import_history",
      );
      const list = await invoke<{ records: HistorySummary[]; warnings: string[] }>("grok_history");
      history = list.records;
      const warnings = [...result.warnings, ...list.warnings];
      notice = `已导入 ${result.imported} 个会话，跳过 ${result.skipped} 个会话${warnings.length ? `；${warnings.length} 项提示：${warnings.join("；")}` : ""}`;
    } catch (e) {
      report(e);
      notice = "导入未完成，请查看错误信息";
    } finally {
      managing = false;
    }
  }
  async function restoreDraft() {
    const draft = await invoke<{
      text: string;
      images: PromptImage[];
      unsentPrompt?: { text: string; images: PromptImage[] };
    } | null>("grok_load_draft");
    prompt = draft?.text ?? localStorage.getItem("grok-workbench.newDraft") ?? "";
    draftImages = draft?.images ?? [];
    unsentPrompt = draft?.unsentPrompt;
  }
  async function manageHistory(
    item: HistorySummary,
    patch: { title?: string; archived?: boolean },
  ) {
    if (busy || connecting || switching || configChanging || closing || managing || imageLoading)
      return;
    managing = true;
    try {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      await persist();
      const current = await readSession(item.sessionId);
      const updated = JSON.parse(JSON.stringify({ ...current, ...patch })) as SessionRecord;
      await invoke("grok_save", { record: updated });
      history = history.map((h) => (h.sessionId === item.sessionId ? historySummary(updated) : h));
      if (item.sessionId === sessionId) {
        sessionSaver.remember(updated);
        title = updated.title;
        archived = Boolean(updated.archived);
        if (patch.archived === true) await fresh(true);
      }
      renamingId = "";
    } catch (e) {
      report(e);
    } finally {
      managing = false;
    }
  }
  function changed() {
    if (!saveTimer)
      saveTimer = setTimeout(() => {
        saveTimer = undefined;
        void persist().catch(report);
      }, 800);
    if (follow)
      void tick().then(() => {
        if (follow) viewport?.scrollTo({ top: viewport.scrollHeight });
      });
  }
  async function manageSubagent(id: string, action: "refresh" | "cancel"): Promise<string> {
    if (!ready || connecting || switching || closing || managing || configChanging)
      throw new Error("请先连接当前会话");
    const rootId = sessionId;
    const generation = client.generation;
    const request = client.request.bind(client);
    if (action === "cancel") return cancelSubagent(request, id);
    const agent = transcript.subagents?.find((item) => item.id === id);
    if (!agent) throw new Error("子任务记录不存在");
    const updated = await refreshSubagent(request, agent);
    if (rootId !== sessionId || generation !== client.generation) throw new Error("会话连接已改变");
    transcript = {
      ...transcript,
      subagents: transcript.subagents?.map((item) =>
        item.id === id ? { ...updated, transcript: item.transcript } : item,
      ),
    };
    await persist();
    return "子任务状态已更新";
  }
  function receive(message: RpcMessage) {
    if (sessionMethods.includes(message.method ?? "")) {
      const update = message.params?.update as Record<string, unknown>;
      if (!update) return;
      if (
        message.params?.sessionId === sessionId &&
        update.sessionUpdate === "config_option_update"
      )
        options = update.configOptions as ConfigOption[];
      if (!replaying) {
        const next = applySessionEvent(transcript, sessionId, message);
        if (next !== transcript) {
          transcript = next;
          changed();
        }
      }
    } else if (message.method === "session/request_permission" && message.id !== undefined) {
      permissions = [
        ...permissions,
        { id: message.id, params: message.params as unknown as Permission["params"] },
      ];
      status = "等待授权";
    } else if (
      message.id !== undefined &&
      [
        "_x.ai/ask_user_question",
        "x.ai/ask_user_question",
        "_x.ai/exit_plan_mode",
        "x.ai/exit_plan_mode",
      ].includes(message.method ?? "")
    ) {
      const params = message.params ?? {};
      const kind = message.method!.endsWith("ask_user_question") ? "question" : "plan";
      interactions = [
        ...interactions,
        {
          id: message.id,
          kind,
          questions: params.questions as Question[] | undefined,
          planContent: params.planContent as string | undefined,
          mode: params.mode as string | undefined,
        },
      ];
      status = kind === "question" ? "等待你的回答" : "等待确认计划";
    } else if (message.id !== undefined && message.method) {
      void client
        .send({
          id: message.id,
          error: { code: -32601, message: `Grok Workbench does not provide ${message.method}` },
        })
        .catch(report);
    }
  }
  async function chooseFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择 Grok 工作目录",
      });
      if (typeof selected === "string") {
        if (
          switching ||
          busy ||
          connecting ||
          configChanging ||
          closing ||
          imageLoading ||
          managing
        )
          return;
        await fresh();
        cwd = selected;
        localStorage.setItem("grok-workbench.cwd", cwd);
      }
    } catch (e) {
      report(e);
    }
  }
  async function fresh(fromArchive = false) {
    if (
      imageLoading ||
      switching ||
      busy ||
      connecting ||
      configChanging ||
      closing ||
      (managing && !fromArchive)
    )
      return;
    switching = true;
    try {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      await persist();
      if (client) await client.disconnect();
      ready = false;
      sessionId = "";
      recordSource = undefined;
      sessionSaver.remember();
      draftImages = [];
      archived = false;
      pendingConfig = {};
      await restoreDraft();
      interactions = [];
      messageQueue.restore([]);
      editingQueueId = null;
      title = "新会话";
      transcript = { blocks: [], plan: [] };
      options = [];
      permissions = [];
      status = "未连接";
      error = "";
      notice = "";
      filter = "all";
      await persist();
    } finally {
      switching = false;
    }
  }
  async function load(item: HistorySummary) {
    if (item.sessionId === sessionId) return;
    if (imageLoading || switching || busy || connecting || configChanging || closing || managing)
      return;
    switching = true;
    try {
      clearTimeout(saveTimer);
      saveTimer = undefined;
      await persist();
      const saved = await readSession(item.sessionId);
      await client.disconnect();
      ready = false;
      sessionSaver.remember(saved);
      recordSource = saved.source;
      sessionId = saved.sessionId;
      localStorage.setItem("grok-workbench.activeSession", sessionId);
      archived = Boolean(saved.archived);
      pendingConfig = { ...saved.pendingConfig };
      prompt = saved.draft ?? "";
      draftImages = [...(saved.draftImages ?? [])];
      interactions = [];
      cwd = saved.cwd;
      projectPath = cwd;
      title = saved.title;
      transcript = JSON.parse(
        JSON.stringify({ blocks: saved.blocks, plan: saved.plan, subagents: saved.subagents }),
      ) as Transcript;
      transcript = restoreSubagents(finishTools(transcript));
      messageQueue.restore(saved.queuedPrompts ?? []);
      editingQueueId = null;
      options = [];
      permissions = [];
      status = "历史会话 · 可继续";
      error = "";
      notice = "";
      changed();
    } catch (e) {
      report(e);
    } finally {
      switching = false;
    }
  }
  async function useProjectPath() {
    if (
      !projectPath.trim() ||
      switching ||
      busy ||
      connecting ||
      configChanging ||
      closing ||
      imageLoading ||
      managing
    )
      return;
    try {
      await fresh();
      cwd = projectPath.trim();
      localStorage.setItem("grok-workbench.cwd", cwd);
      settings = false;
    } catch (e) {
      report(e);
    }
  }
  function resizeText(delta: number) {
    fontSize = Math.max(13, Math.min(22, fontSize + delta));
    localStorage.setItem("grok-workbench.fontSize", String(fontSize));
  }
  function connect(): Promise<void> {
    if (ready) return Promise.resolve();
    if (!connection)
      connection = establishConnection().finally(() => {
        connection = undefined;
      });
    return connection;
  }
  async function establishConnection() {
    if (ready) return;
    if (!cwd.trim()) throw new Error("请先选择项目文件夹");
    connecting = true;
    status = "正在连接 Grok…";
    try {
      const init = await client.connect(executable, cwd, permissionMode);
      activePermissionMode = permissionMode;
      canLoad = Boolean((init.agentCapabilities as Record<string, unknown>)?.loadSession);
      const meta = init._meta as Record<string, unknown> | undefined;
      if (meta?.agentVersion) version = `Grok Build ${meta.agentVersion}`;
      if (sessionId && !canLoad) throw new Error("当前 Grok CLI 未提供会话恢复，请新建会话");
      replaying = !!sessionId;
      const result = await client.request(sessionId ? "session/load" : "session/new", {
        cwd,
        mcpServers: [],
        ...(sessionId ? { sessionId } : {}),
      });
      if (!sessionId) {
        sessionId = String(result.sessionId);
        localStorage.removeItem("grok-workbench.newDraft");
      }
      options = (result.configOptions as ConfigOption[]) ?? [];
      ready = true;
      status = "已连接 · 就绪";
      localStorage.setItem("grok-workbench.cwd", cwd);
      await persist();
      unsentPrompt = undefined;
      await invoke("grok_save_draft", { draft: { text: "", images: [] } });
    } catch (e) {
      ready = false;
      await client.disconnect();
      status = "连接失败";
      throw e;
    } finally {
      replaying = false;
      connecting = false;
    }
  }
  async function connectButton() {
    error = "";
    try {
      await connect();
    } catch (e) {
      report(e);
    }
  }
  function send() {
    if (
      (!prompt.trim() && !draftImages.length) ||
      imageLoading ||
      managing ||
      configChanging ||
      switching ||
      closing ||
      !mounted ||
      !cwd
    )
      return;
    const text = prompt.trim();
    const images = [...draftImages];
    draftImages = [];
    archived = false;
    prompt = "";
    messageQueue.enqueue(text, images);
  }
  async function executePrompt(text: string, images: PromptImage[] = []): Promise<boolean> {
    error = "";
    let completed = false;
    if (!sessionId) unsentPrompt = { text, images: [...images] };
    try {
      if (!transcript.blocks.some((b) => b.type === "user"))
        title = text.slice(0, 45) || images[0]?.name || "图片对话";
      transcript = {
        ...transcript,
        blocks: [...transcript.blocks, { type: "user", text, images }],
      };
      changed();
      await persist();
      if (ready && activePermissionMode !== permissionMode) {
        await client.disconnect();
        ready = false;
      }
      await connect();
      const changes = Object.entries(pendingConfig);
      if (changes.length) {
        configChanging = true;
        try {
          for (const [configId, value] of changes) {
            const result = await client.request("session/set_config_option", {
              sessionId,
              configId,
              value,
            });
            if (result.configOptions) options = result.configOptions as ConfigOption[];
            if (pendingConfig[configId] === value) delete pendingConfig[configId];
          }
        } finally {
          configChanging = false;
        }
      }
      status = "Grok 正在工作";
      await persist();
      const result = await client.request("session/prompt", {
        sessionId,
        prompt: [...(text ? [{ type: "text", text }] : []), ...imageContent(images)],
      });
      status = result.stopReason === "cancelled" ? "已停止" : "本轮完成";
      completed = result.stopReason === "end_turn";
    } catch (e) {
      report(e);
      status = "任务未完成";
    } finally {
      stopping = false;
      permissions = [];
      interactions = [];
      transcript = finishTools(transcript);
      try {
        await persist();
      } catch (e) {
        report(e);
        completed = false;
      }
      changed();
    }
    return completed;
  }
  async function stop() {
    messageQueue.pause();
    try {
      stopping = true;
      status = "正在停止…";
      for (const permission of permissions)
        await client.send({ id: permission.id, result: { outcome: { outcome: "cancelled" } } });
      permissions = [];
      for (const interaction of interactions)
        await client.send({ id: interaction.id, result: { outcome: "cancelled" } });
      interactions = [];
      await client.send({ method: "session/cancel", params: { sessionId } });
    } catch (e) {
      stopping = false;
      report(e);
    }
  }
  async function disconnect() {
    messageQueue.pause();
    const pendingConnection = connection;
    await client.disconnect();
    await pendingConnection?.catch(() => {});
    transcript = restoreSubagents(transcript);
    ready = false;
    stopping = false;
    connecting = false;
    permissions = [];
    interactions = [];
    status = "已断开";
    await persist();
  }
  async function decide(permission: Permission, optionId: string) {
    try {
      await client.send({
        id: permission.id,
        result: { outcome: { outcome: "selected", optionId } },
      });
      permissions = permissions.filter((p) => p.id !== permission.id);
      status = permissions.length ? "等待授权" : "Grok 正在工作";
    } catch (e) {
      report(e);
    }
  }
  async function respondInteraction(interaction: Interaction, result: Record<string, unknown>) {
    await client.send({ id: interaction.id, result });
    interactions = interactions.filter((item) => item.id !== interaction.id);
    status = interactions.length
      ? "等待你的回应"
      : permissions.length
        ? "等待授权"
        : "Grok 正在工作";
  }
  async function changeConfig(option: ConfigOption, value: string) {
    if (busy) {
      if (value === option.currentValue) delete pendingConfig[option.id];
      else pendingConfig[option.id] = value;
      notice = "设置已选好，从下一条需求开始生效";
      void persist().catch(report);
      return;
    }
    configChanging = true;
    try {
      const result = await client.request("session/set_config_option", {
        sessionId,
        configId: option.id,
        value,
      });
      if (result.configOptions) options = result.configOptions as ConfigOption[];
      delete pendingConfig[option.id];
    } catch (e) {
      report(e);
    } finally {
      configChanging = false;
    }
  }
  async function checkCli() {
    try {
      version = await invoke<string>("grok_version", { executable });
      localStorage.setItem("grok-workbench.executable", executable);
      error = "";
    } catch (e) {
      report(e);
    }
  }
  async function copyAnswer(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notice = "回答已复制";
    } catch (e) {
      report(e);
    }
  }
  async function exportChat() {
    try {
      const path = await save({
        defaultPath: "Grok-会话.md",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return;
      await invoke("grok_export", { path, content: exportMarkdown(record()) });
      notice = `已导出：${path}`;
    } catch (e) {
      report(e);
    }
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  onMount(() => {
    leftWidth = Math.max(
      220,
      Math.min(480, Number(localStorage.getItem("grok-workbench.leftWidth")) || 252),
    );
    rightWidth = Math.max(
      200,
      Math.min(480, Number(localStorage.getItem("grok-workbench.rightWidth")) || 252),
    );
    cwd = localStorage.getItem("grok-workbench.cwd") ?? "";
    projectPath = cwd;
    fontSize = Number(localStorage.getItem("grok-workbench.fontSize")) || 18;
    lineHeight = Number(localStorage.getItem("grok-workbench.lineHeight")) || 1.85;
    focusMode = localStorage.getItem("grok-workbench.focusMode") === "true";
    permissionMode = localStorage.getItem("grok-workbench.permissionMode") || "bypassPermissions";
    executable = localStorage.getItem("grok-workbench.executable") ?? "grok";
    if (!isTauri()) {
      status = "界面预览";
      error = "当前是浏览器预览。请启动桌面应用以连接本机 Grok CLI。";
      return;
    }
    client = new GrokClient(receive, log, (exitStatus) => {
      messageQueue.pause();
      ready = false;
      connecting = false;
      stopping = false;
      permissions = [];
      interactions = [];
      status = `连接已结束：${exitStatus}`;
      transcript = finishTools(transcript);
      void persist().catch(report);
    });
    let disposed = false;
    let unlistenClose: (() => void) | undefined;
    void (async () => {
      await client.mount();
      if (disposed) {
        client.dispose();
        return;
      }
      unlistenClose = await getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        if (closing) return;
        if (imageLoading) {
          notice = "正在读取图片，请稍后关闭窗口";
          return;
        }
        closing = true;
        messageQueue.pause();
        try {
          clearTimeout(saveTimer);
          saveTimer = undefined;
          await persist();
          await invoke("grok_quit");
        } catch (e) {
          closing = false;
          report(e);
        }
      });
      const savedHistory = await invoke<{ records: HistorySummary[]; warnings: string[] }>(
        "grok_history",
      );
      history = savedHistory.records;
      if (savedHistory.warnings.length) {
        notice = `有 ${savedHistory.warnings.length} 份历史记录无法读取，原文件已保留：${savedHistory.warnings.join("；")}`;
      }
      const activeSummary = history.find(
        (item) => item.sessionId === localStorage.getItem("grok-workbench.activeSession"),
      );
      let active: StoredSession | undefined;
      if (activeSummary) {
        try {
          active = await readSession(activeSummary.sessionId);
        } catch (e) {
          report(e);
        }
      }
      if (active) {
        sessionSaver.remember(active);
        recordSource = active.source;
        sessionId = active.sessionId;
        archived = Boolean(active.archived);
        showArchived = archived;
        pendingConfig = { ...active.pendingConfig };
        cwd = active.cwd;
        projectPath = cwd;
        title = active.title;
        prompt = active.draft ?? "";
        draftImages = [...(active.draftImages ?? [])];
        transcript = restoreSubagents(
          finishTools({ blocks: active.blocks, plan: active.plan, subagents: active.subagents }),
        );
        messageQueue.restore(active.queuedPrompts ?? []);
        status = "历史会话 · 可继续";
      } else await restoreDraft();
      await checkCli();
      mounted = true;
    })().catch(report);
    return () => {
      disposed = true;
      clearTimeout(saveTimer);
      unlistenClose?.();
      client.dispose();
    };
  });
</script>

<svelte:window bind:innerWidth={windowWidth} />

<svelte:head
  ><title>Grok Workbench</title><meta
    name="description"
    content="Grok Build 的桌面可视化工作台"
  /></svelte:head
>

<div
  class="workbench"
  class:focus-mode={focusMode}
  style={`--reading-size:${fontSize}px;--reading-line-height:${lineHeight};--left-width:${displayedLeft}px;--right-width:${displayedRight}px`}
>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">╱</div>
      <div>Grok <strong>Workbench</strong><small>让每一步工作都清晰可见</small></div>
    </div>
    <button
      class="new-session"
      disabled={busy || connecting || switching || managing || !mounted}
      onclick={() => fresh().catch(report)}><span>＋</span> 新建会话 <kbd>NEW</kbd></button
    >
    <div class="sidebar-label">工作目录</div>
    <button
      class="project"
      disabled={busy || connecting || switching || !mounted}
      onclick={chooseFolder}
      title={cwd}
      ><span>▱</span>
      <div>{projectName}<small>{cwd || "为 Grok 指定一个本地项目"}</small></div>
      <span>⌄</span></button
    >
    <div class="sidebar-label history-label">
      会话记录 <span>{history.filter((h) => Boolean(h.archived) === showArchived).length}</span>
    </div>
    <button
      class="history-import"
      disabled={!mounted ||
        busy ||
        connecting ||
        switching ||
        managing ||
        configChanging ||
        closing ||
        imageLoading}
      onclick={importHistory}>{managing ? "正在处理历史…" : "导入 Grok 历史"}</button
    >
    <div class="history-tabs">
      <button
        class:chosen={!showArchived}
        onclick={() => {
          showArchived = false;
          renamingId = "";
        }}>进行中</button
      >
      <button
        class:chosen={showArchived}
        onclick={() => {
          showArchived = true;
          renamingId = "";
        }}>已归档</button
      >
    </div>
    <input
      class="history-search"
      aria-label="搜索会话"
      placeholder="搜索会话…"
      bind:value={search}
    />
    <div class="history-list">
      {#each visibleHistory as item (item.sessionId)}<div class="history-entry">
          <button
            class="history-open"
            class:active={item.sessionId === sessionId}
            disabled={busy || connecting || switching || managing}
            title={item.title}
            onclick={() => load(item)}
            ><span>{item.title}</span><small
              >{item.cwd.split(/[\\/]/).at(-1)} · {new Date(item.updatedAt).toLocaleDateString(
                "zh-CN",
                { month: "short", day: "numeric" },
              )}</small
            ></button
          >
          {#if renamingId === item.sessionId}
            <form
              class="history-rename"
              onsubmit={(event) => {
                event.preventDefault();
                if (renameText.trim()) void manageHistory(item, { title: renameText.trim() });
              }}
            >
              <input aria-label="会话名称" bind:value={renameText} maxlength="160" />
              <button disabled={managing || !renameText.trim()} type="submit">保存</button>
              <button type="button" onclick={() => (renamingId = "")}>取消</button>
            </form>
          {:else}
            <div class="history-actions">
              <button
                disabled={busy || connecting || switching || configChanging || managing}
                onclick={() => {
                  renamingId = item.sessionId;
                  renameText = item.title;
                }}>重命名</button
              >
              <button
                disabled={busy || connecting || switching || configChanging || managing}
                onclick={() => manageHistory(item, { archived: !item.archived })}
                >{item.archived ? "恢复" : "归档"}</button
              >
            </div>
          {/if}
        </div>{/each}
      {#if !visibleHistory.length}<p class="empty-history">
          {search ? "没有匹配的会话" : showArchived ? "暂无已归档会话" : "未归档的会话会显示在这里"}
        </p>{/if}
    </div>
    <div class="sidebar-bottom">
      <div class="local-label"><i></i> 本地工作台 <span>v0.2</span></div>
      <button onclick={() => (settings = !settings)}>⚙ <span>连接与显示设置</span></button><small
        >基于 OpenCovibe · Apache-2.0</small
      >
    </div>
  </aside>
  <PanelResize
    side="left"
    width={displayedLeft}
    min={220}
    max={leftMax}
    onresize={(value, save) => resizePanel("left", value, save)}
  />
  <main>
    <header>
      <div class="breadcrumb">工作台 <span>/</span> {projectName}</div>
      <div class="header-right">
        <span class="connection" class:online={ready}><i></i>{version || "Grok Build"}</span><button
          class="icon-button"
          title="导出当前会话"
          disabled={!transcript.blocks.length}
          onclick={exportChat}>导出 ↗</button
        >
      </div>
    </header>
    <div class="session-bar">
      <div>
        <h1>{title}</h1>
        {#if archived}<small class="muted">已归档 · 发送新需求会恢复此会话</small>{/if}
        <p><span class="status-dot" class:pulse={busy || connecting}></span>{status}</p>
      </div>
      <div class="view-controls">
        <button
          class:chosen={focusMode}
          onclick={() => {
            focusMode = !focusMode;
            saveDisplay();
          }}>专注</button
        >
        <button onclick={() => resizeText(-1)} title="缩小文字">A−</button><button
          onclick={() => resizeText(1)}
          title="放大文字">A＋</button
        ><span></span><button class:chosen={filter === "all"} onclick={() => (filter = "all")}
          >全部</button
        ><button class:chosen={filter === "answers"} onclick={() => (filter = "answers")}
          >回答</button
        ><button class:chosen={filter === "tools"} onclick={() => (filter = "tools")}>工具</button>
      </div>
    </div>
    {#if settings}<section class="settings-panel">
        <div>
          <h2>连接与显示设置</h2>
          <button onclick={() => (settings = false)}>关闭 ×</button>
        </div>
        <label
          >项目路径<input
            aria-label="项目路径"
            bind:value={projectPath}
            disabled={busy || connecting}
            placeholder="粘贴本地项目文件夹路径"
          /></label
        >
        <button
          disabled={!mounted || busy || connecting || !projectPath.trim()}
          onclick={useProjectPath}>使用此项目</button
        >
        <label
          >Grok 可执行文件<input
            bind:value={executable}
            disabled={ready || busy || connecting}
            placeholder="grok 或 grok.exe 的完整路径"
          /></label
        >
        <p>沿用本机 Grok 登录。首次使用请在终端执行 <code>grok login</code>。</p>
        <label
          >阅读行距
          <select bind:value={lineHeight} onchange={saveDisplay}>
            <option value={1.6}>紧凑</option><option value={1.85}>舒适</option><option value={2.1}
              >宽松</option
            >
          </select>
        </label>
        <p>正文 {fontSize}px；使用顶部 A− / A＋ 同时调整正文、代码和工具输出。</p>
        <button disabled={!mounted || busy || connecting} onclick={checkCli}>检测 CLI</button><label
          class="check"><input type="checkbox" bind:checked={follow} /> 跟随最新输出</label
        >
        <details>
          <summary>连接日志（{diagnostics.length}）</summary>
          <pre>{diagnostics.join("\n") || "暂无日志"}</pre>
        </details>
      </section>{/if}
    {#if notice}<div class="notice-banner" role="status">
        <span>{notice}</span><button aria-label="关闭提示" onclick={() => (notice = "")}>×</button>
      </div>{/if}
    {#if error}<div class="error-banner" role="alert">
        <span>{error}</span><button onclick={() => (error = "")} aria-label="关闭错误提示">×</button
        >
      </div>{/if}
    <div
      class="conversation"
      bind:this={viewport}
      onscroll={() => {
        if (viewport)
          follow = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100;
      }}
    >
      <div class="reading-column">
        {#if !transcript.blocks.length}
          <section class="welcome">
            <div class="eyebrow"><span></span> GROK BUILD, IN FOCUS</div>
            <div class="welcome-symbol">╱</div>
            <h2>想法在这里，<br /><span>变成清晰的进展。</span></h2>
            <p>
              和 Grok 一起写代码。把思考、工具执行与文件修改，<br
              />放进一个读得清、看得懂的工作空间。
            </p>
            <div class="suggestions">
              <button onclick={() => (prompt = "先阅读这个项目，解释整体结构和启动方法。")}
                ><span>▱</span><strong>读懂项目</strong><small>梳理结构与运行方式</small></button
              ><button onclick={() => (prompt = "检查当前项目的问题，先说明发现和修改计划。")}
                ><span>⌕</span><strong>定位问题</strong><small>从现象找到具体原因</small></button
              ><button onclick={() => (prompt = "帮我实现一个功能：")}
                ><span>＋</span><strong>实现想法</strong><small>从需求推进到代码</small></button
              >
            </div>
            <div class="welcome-note">选择左侧项目文件夹，然后发送第一条任务</div>
          </section>
        {/if}
        {#each transcript.subagents ?? [] as agent (agent.id)}<SubagentCard
            {agent}
            canManage={ready &&
              !connecting &&
              !switching &&
              !closing &&
              !managing &&
              !configChanging}
            manage={(action) => manageSubagent(agent.id, action)}
          />{/each}
        {#key sessionId + ":" + filter}
          {#each visibleBlocks as block}
            {#if block.type === "user"}<article class="user-message">
                <div class="message-label">你</div>
                <div>{block.text}</div>
                {#if block.images?.length}<div class="message-images">
                    {#each block.images as image}<img
                        src={imageUrl(image)}
                        alt={image.name}
                      />{/each}
                  </div>{/if}
              </article>
            {:else if block.type === "answer"}<article class="answer-message">
                <div class="message-label">
                  <span class="mini-mark">╱</span> GROK
                  <button onclick={() => copyAnswer(block.text)}>复制</button>
                </div>
                <RichText text={block.text} />
              </article>
            {:else if block.type === "thought"}<ThoughtBlock text={block.text} />
            {:else if block.type === "tool"}<ToolCard tool={block.tool} />{/if}
          {/each}
        {/key}
        {#if busy}<div class="working-line">
            <span class="status-dot pulse"></span>{interactions.length
              ? status
              : permissions.length
                ? "等待你确认工具操作"
                : stopping
                  ? "正在结束当前任务…"
                  : "Grok 正在工作…"}
          </div>{/if}
      </div>
    </div>
    <div class="composer-region">
      {#each interactions as interaction (interaction.id)}
        <InteractionCard
          {interaction}
          respond={(result) => respondInteraction(interaction, result)}
        />
      {/each}
      {#each permissions as permission}<div class="permission">
          <strong>需要授权 · {permission.params.toolCall.title || "工具操作"}</strong>
          <pre>{JSON.stringify(
              permission.params.toolCall.rawInput ?? permission.params.toolCall.content,
              null,
              2,
            )}</pre>
          <div>
            {#each permission.params.options as option}<button
                class:reject={option.kind.startsWith("reject")}
                onclick={() => decide(permission, option.optionId)}>{option.name}</button
              >{/each}
          </div>
        </div>{/each}
      {#if !follow && busy}<button
          class="follow-button"
          onclick={() => {
            follow = true;
            changed();
          }}>↓ 回到最新输出</button
        >{/if}
      {#if queueView.pending.length}
        <section class="prompt-queue" aria-label="待执行需求">
          <div class="queue-heading">
            <span
              >{queueView.paused ? "队列已暂停" : "等待执行"} · {queueView.pending.length} 条</span
            >
            <button
              disabled={closing ||
                configChanging ||
                switching ||
                connecting ||
                editingQueueId !== null}
              onclick={() => (queueView.paused ? messageQueue.resume() : messageQueue.pause())}
            >
              {queueView.paused ? "继续队列" : "暂停队列"}
            </button>
          </div>
          {#each queueView.pending as item, index (item.id)}
            <div class="queued-prompt">
              <span class="queue-position">{index + 1}</span>
              {#if editingQueueId === item.id}
                <div class="queue-editor">
                  <textarea aria-label="编辑排队需求" bind:value={queuedEdit} rows="2"></textarea>
                  <button
                    disabled={!queuedEdit.trim()}
                    onclick={() => {
                      messageQueue.edit(item.id, queuedEdit);
                      editingQueueId = null;
                    }}>保存</button
                  >
                  <button onclick={() => (editingQueueId = null)}>取消</button>
                </div>
              {:else}
                <p title={item.text}>
                  {item.text || "图片需求"}{#if item.images?.length}<small>
                      · {item.images.length} 张图片</small
                    >{/if}
                </p>
                <div class="queue-actions">
                  <button
                    disabled={index === 0}
                    aria-label={`上移第 ${index + 1} 条需求`}
                    onclick={() => messageQueue.moveUp(item.id)}>↑</button
                  >
                  <button
                    aria-label={`编辑第 ${index + 1} 条需求`}
                    onclick={() => {
                      messageQueue.pause();
                      editingQueueId = item.id;
                      queuedEdit = item.text;
                    }}>编辑</button
                  >
                  <button
                    aria-label={`删除第 ${index + 1} 条需求`}
                    onclick={() => messageQueue.remove(item.id)}>×</button
                  >
                </div>
              {/if}
            </div>
          {/each}
        </section>
      {/if}
      <div class="composer">
        <input
          class="image-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          bind:this={imageInput}
          onchange={(event) => {
            void addImages(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
        />
        {#if draftImages.length}<div class="draft-images">
            {#each draftImages as image, index}<div>
                <img src={imageUrl(image)} alt={image.name} /><button
                  title={`移除 ${image.name}`}
                  aria-label={`移除图片 ${index + 1}`}
                  onclick={() => {
                    draftImages = draftImages.filter((_, i) => i !== index);
                    void persist().catch(report);
                  }}>×</button
                >
              </div>{/each}
          </div>{/if}
        {#if !sessionId && unsentPrompt && !busy}
          <div class="notice-banner" role="status">
            <span
              >上次需求尚未发送：{unsentPrompt.text || "图片需求"}（{unsentPrompt.images.length} 张图片）</span
            >
            <button
              type="button"
              disabled={!mounted || connecting || !cwd}
              onclick={() => {
                if (unsentPrompt) messageQueue.enqueue(unsentPrompt.text, unsentPrompt.images);
              }}>重新发送</button
            >
            <button
              type="button"
              onclick={() => {
                unsentPrompt = undefined;
                void persist().catch(report);
              }}>移除</button
            >
          </div>
        {/if}
        <textarea
          onpaste={pasteImages}
          aria-label="给 Grok 的任务"
          bind:value={prompt}
          oninput={() => {
            if (!saveTimer)
              saveTimer = setTimeout(() => {
                saveTimer = undefined;
                void persist().catch(report);
              }, 800);
          }}
          onkeydown={keydown}
          placeholder={busy ? "继续输入下一条需求，按 Enter 加入队列…" : "告诉 Grok 你想做什么…"}
          rows="3"
          disabled={!mounted || closing || imageLoading || managing || switching}
        ></textarea>
        <div class="composer-toolbar">
          <button
            class="attach-image"
            disabled={imageLoading || managing || switching || closing || draftImages.length >= 4}
            onclick={() => imageInput.click()}
            title="添加图片，也可在输入框粘贴截图">{imageLoading ? "读取中…" : "＋ 图片"}</button
          >
          <div class="model-options">
            <select
              aria-label="授权模式"
              title="Grok 工具授权模式"
              value={permissionMode}
              disabled={closing || connecting || switching || configChanging}
              onchange={(e) => changePermission(e.currentTarget.value)}
            >
              {#each permissionModes as mode}<option value={mode.value}>{mode.name}</option>{/each}
            </select>
            {#each options.filter((o) => o.type === "select") as option}<select
                aria-label={option.name}
                value={pendingConfig[option.id] ?? option.currentValue}
                title={busy ? "可提前选择，从下一条需求开始生效" : option.name}
                disabled={closing || connecting || switching || configChanging}
                onchange={(e) => changeConfig(option, e.currentTarget.value)}
                >{#each option.options as choice}<option value={choice.value}>{choice.name}</option
                  >{/each}</select
              >{/each}{#if !ready}<button
                disabled={!mounted || connecting || switching || !cwd}
                onclick={connectButton}>{connecting ? "连接中…" : "连接 Grok"}</button
              >{/if}
          </div>
          <div class="send-group">
            {#if connecting || stopping}<button
                class="stop-button"
                onclick={() => disconnect().catch(report)}>断开连接</button
              >{:else if busy}<button class="stop-button" onclick={stop}>■ 停止</button>{/if}
            <span
              >{busy || queueView.pending.length ? "Enter 加入队列" : "Enter 发送"} · Shift+Enter 换行</span
            >
            <button
              class="send-button"
              aria-label={busy || queueView.pending.length ? "加入队列" : "发送任务"}
              title={busy || queueView.pending.length ? "上一条完成后自动执行" : "发送任务"}
              disabled={!mounted ||
                (!prompt.trim() && !draftImages.length) ||
                imageLoading ||
                managing ||
                !cwd ||
                configChanging ||
                switching ||
                closing}
              onclick={send}>↑</button
            >
          </div>
        </div>
      </div>
      <div class="composer-foot">
        {#if hasPendingConfig}<span class="pending-config">设置待应用 · 下一条需求生效</span>{/if}
        <span
          >{permissionMode === "bypassPermissions"
            ? "完全允许 · Grok 可直接执行命令和修改文件"
            : "Grok CLI 执行任务 · Workbench 呈现过程"}</span
        ><span>{sessionId ? "会话保存在本机" : "准备开始"}</span>
      </div>
    </div>
  </main>
  <PanelResize
    side="right"
    width={displayedRight}
    min={200}
    max={rightMax}
    onresize={(value, save) => resizePanel("right", value, save)}
  />
  <aside class="inspector">
    <div class="inspector-heading">任务概览 <span>◉</span></div>
    <div class="overview-state">
      <small>当前状态</small><strong>{status}</strong>
      <p>{ready ? "已连接本机 Grok CLI" : "连接后实时展示执行进展"}</p>
    </div>
    <div class="stats">
      <div><strong>{tools.length}</strong><small>工具调用</small></div>
      <div><strong>{completed}</strong><small>已完成</small></div>
    </div>
    <div class="inspector-label">执行计划</div>
    {#if transcript.plan.length}<ol class="plan">
        {#each transcript.plan as step}<li class:done={step.status === "completed"}>
            <span
              >{step.status === "completed" ? "✓" : step.status === "in_progress" ? "◉" : "○"}</span
            >{step.content}
          </li>{/each}
      </ol>{:else}<div class="plan-empty">
        <span>☷</span>
        <p>Grok 的计划会显示在这里</p>
        <small>跟随任务推进，查看每一步状态</small>
      </div>{/if}
    <div class="inspector-tip">
      <span>阅读更轻松</span>
      <p>思考与工具输出可展开查看。使用顶部筛选，只看回答或工具活动。</p>
    </div>
  </aside>
</div>
