mod grok;
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
            grok::grok_export,
            grok_quit
        ])
        .run(tauri::generate_context!())
        .expect("Grok Workbench 启动失败");
}
