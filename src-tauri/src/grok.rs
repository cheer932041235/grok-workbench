use serde_json::{json, Value};
use std::{path::PathBuf, process::Stdio, sync::Arc};
use tauri::{Emitter, Manager, State};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{ChildStdin, Command},
    sync::{mpsc, oneshot, Mutex},
};

struct Connection {
    input: ChildStdin,
    stop: mpsc::Sender<()>,
    finished: oneshot::Receiver<()>,
    generation: u64,
}
#[derive(Default)]
pub struct GrokState {
    connection: Arc<Mutex<Option<Connection>>>,
    counter: Mutex<u64>,
}

fn command(executable: &str) -> Command {
    let mut cmd = Command::new(executable);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd
}

#[tauri::command]
pub async fn grok_version(executable: String) -> Result<String, String> {
    let output = command(&executable)
        .arg("--version")
        .output()
        .await
        .map_err(|e| format!("无法启动 Grok：{e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).into());
    }
    Ok(String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .take(2)
        .collect::<Vec<_>>()
        .join(" "))
}

#[tauri::command]
pub async fn grok_connect(
    app: tauri::AppHandle,
    state: State<'_, GrokState>,
    executable: String,
    cwd: String,
    permission_mode: String,
) -> Result<u64, String> {
    if !PathBuf::from(&cwd).is_dir() {
        return Err("请选择存在的项目文件夹".into());
    }
    let mut slot = state.connection.lock().await;
    if slot.is_some() {
        return Err("请先断开当前 Grok 会话".into());
    }
    let mut child = command(&executable)
        .args(["--permission-mode", &permission_mode, "agent", "stdio"])
        .current_dir(&cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("无法启动 Grok：{e}"))?;
    let input = child.stdin.take().ok_or("Grok stdin 不可用")?;
    let stdout = child.stdout.take().ok_or("Grok stdout 不可用")?;
    let stderr = child.stderr.take().ok_or("Grok stderr 不可用")?;
    let mut counter = state.counter.lock().await;
    *counter += 1;
    let generation = *counter;
    let (stop, mut stop_rx) = mpsc::channel(1);
    let (finished_tx, finished) = oneshot::channel();
    *slot = Some(Connection {
        input,
        stop,
        finished,
        generation,
    });
    let event_app = app.clone();
    let reader = tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            match serde_json::from_str::<Value>(&line) {
                Ok(message) => {
                    let _ = event_app.emit(
                        "grok-message",
                        json!({"generation":generation,"message":message}),
                    );
                }
                Err(e) => {
                    let _ = event_app.emit(
                        "grok-diagnostic",
                        json!({"generation":generation,"text":format!("ACP 数据解析失败：{e}")}),
                    );
                }
            }
        }
    });
    let err_app = app.clone();
    let err_reader = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = err_app.emit(
                "grok-diagnostic",
                json!({"generation":generation,"text":line}),
            );
        }
    });
    let connection = state.connection.clone();
    tokio::spawn(async move {
        let status = tokio::select! {
            status = child.wait() => status.map(|s|s.to_string()).unwrap_or_else(|e|e.to_string()),
            _ = stop_rx.recv() => { let _ = child.kill().await; "已断开".into() }
        };
        let _ = reader.await;
        let _ = err_reader.await;
        let mut slot = connection.lock().await;
        if slot.as_ref().is_some_and(|c| c.generation == generation) {
            *slot = None;
        }
        let _ = app.emit(
            "grok-exit",
            json!({"generation":generation,"status":status}),
        );
        let _ = finished_tx.send(());
    });
    Ok(generation)
}

#[tauri::command]
pub async fn grok_send(
    state: State<'_, GrokState>,
    generation: u64,
    message: Value,
) -> Result<(), String> {
    let mut slot = state.connection.lock().await;
    let connection = slot.as_mut().ok_or("Grok 尚未连接")?;
    if connection.generation != generation {
        return Err("会话连接已改变".into());
    }
    let mut line = serde_json::to_vec(&message).map_err(|e| e.to_string())?;
    line.push(b'\n');
    connection
        .input
        .write_all(&line)
        .await
        .map_err(|e| e.to_string())?;
    connection.input.flush().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn grok_disconnect(state: State<'_, GrokState>) -> Result<(), String> {
    let connection = state.connection.lock().await.take();
    if let Some(connection) = connection {
        let _ = connection.stop.send(()).await;
        let _ = connection.finished.await;
    }
    Ok(())
}

fn history_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sessions");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn grok_save(app: tauri::AppHandle, record: Value) -> Result<(), String> {
    crate::history::save(&history_dir(&app)?, &record)
}

#[tauri::command]
pub fn grok_history(app: tauri::AppHandle) -> Result<Value, String> {
    crate::history::load(&history_dir(&app)?)
}
#[tauri::command]
pub fn grok_export(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn grok_save_draft(app: tauri::AppHandle, draft: Value) -> Result<(), String> {
    let path = history_dir(&app)?.with_file_name("draft.json");
    crate::history::write_json(&path, &draft)
}

#[tauri::command]
pub fn grok_load_draft(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let path = history_dir(&app)?.with_file_name("draft.json");
    crate::history::load_draft(&path)
}

#[tauri::command]
pub fn grok_load(app: tauri::AppHandle, session_id: String) -> Result<Value, String> {
    crate::history::load_record(&history_dir(&app)?, &session_id)
}

#[tauri::command]
pub async fn grok_import_history(app: tauri::AppHandle) -> Result<Value, String> {
    let dir = history_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        crate::history::import_grok(&dir, &crate::history::grok_home()?)
    })
    .await
    .map_err(|e| e.to_string())?
}
