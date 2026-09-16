use serde_json::{json, Value};
use std::process::Stdio;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
};

#[tauri::command]
pub async fn grok_billing(executable: String) -> Result<Value, String> {
    let mut command = Command::new(executable);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    let mut child = command
        .args(["agent", "stdio"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("无法读取账号额度：{e}"))?;
    let mut input = child.stdin.take().ok_or("无法打开 Grok 输入")?;
    let output = child.stdout.take().ok_or("无法打开 Grok 输出")?;
    let result = tokio::time::timeout(std::time::Duration::from_secs(30), async {
        let mut lines = BufReader::new(output).lines();
        for (id, method, params) in [
            (1, "initialize", json!({"protocolVersion":1,"clientCapabilities":{},"clientInfo":{"name":"grok-workbench","version":"0.2.5"}})),
            (2, "_x.ai/billing", json!({})),
        ] {
            let request = json!({"jsonrpc":"2.0","id":id,"method":method,"params":params});
            input.write_all(format!("{request}\n").as_bytes()).await.map_err(|e| e.to_string())?;
            loop {
                let line = lines.next_line().await.map_err(|e| e.to_string())?.ok_or("Grok 已退出，未返回额度")?;
                let message: Value = serde_json::from_str(&line).map_err(|e| e.to_string())?;
                if message.get("id").and_then(Value::as_i64) != Some(id) { continue; }
                if let Some(error) = message.get("error") { return Err(error.get("message").and_then(Value::as_str).unwrap_or("额度读取失败").to_string()); }
                if id == 2 { return message.get("result").cloned().ok_or_else(|| "Grok 未返回额度数据".to_string()); }
                break;
            }
        }
        Err("Grok 未返回额度数据".to_string())
    }).await.map_err(|_| "读取账号额度超时，请手动刷新".to_string());
    let _ = child.kill().await;
    let _ = child.wait().await;
    result?
}
