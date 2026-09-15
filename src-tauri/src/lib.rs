mod files;
mod grok;
mod history;
use tauri::Manager;

#[tauri::command]
async fn grok_quit(
    app: tauri::AppHandle,
    state: tauri::State<'_, grok::GrokState>,
) -> Result<(), String> {
    grok::grok_disconnect(state).await?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn grok_open_releases() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = std::process::Command::new("explorer.exe");
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let mut command = std::process::Command::new("xdg-open");
    command
        .arg("https://github.com/cheer932041235/grok-workbench/releases")
        .spawn()
        .map_err(|e| format!("打开失败：{e}"))?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(grok::GrokState::default())
        .invoke_handler(tauri::generate_handler![
            grok::grok_version,
            grok::grok_connect,
            grok::grok_send,
            grok::grok_disconnect,
            grok::grok_save,
            grok::grok_history,
            grok::grok_load,
            grok::grok_import_history,
            grok::grok_save_draft,
            grok::grok_save_session_draft,
            grok::grok_load_draft,
            grok::grok_export,
            files::grok_preview_file,
            files::grok_open_file,
            grok_open_releases,
            grok_quit
        ])
        .run(tauri::generate_context!())
        .expect("Grok Workbench 启动失败");
}
