use serde_json::{json, Value};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use tauri::Manager;

fn resolve(path: &str, cwd: &str) -> Result<PathBuf, String> {
    if path.starts_with("\\\\") || path.starts_with("//") {
        return Err("请使用本地文件路径".into());
    }
    let input = Path::new(path);
    let full = if input.is_absolute() {
        input.to_path_buf()
    } else {
        if cwd.is_empty() {
            return Err("相对路径需要先选择工作目录".into());
        }
        Path::new(cwd).join(input)
    };
    fs::canonicalize(full).map_err(|e| format!("无法打开文件：{e}"))
}

fn preview(path: &str, cwd: &str) -> Result<Value, String> {
    let path = resolve(path, cwd)?;
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    if !metadata.is_file() {
        return Err("这是文件夹，请打开其中的文件".into());
    }
    let ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "bmp" => Some("image/bmp"),
        _ => None,
    };
    let text = matches!(
        ext.as_str(),
        "" | "md"
            | "markdown"
            | "txt"
            | "log"
            | "json"
            | "jsonl"
            | "rs"
            | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "svelte"
            | "vue"
            | "py"
            | "html"
            | "htm"
            | "css"
            | "scss"
            | "xml"
            | "svg"
            | "yaml"
            | "yml"
            | "toml"
            | "ini"
            | "cfg"
            | "csv"
            | "sql"
            | "sh"
            | "ps1"
            | "bat"
            | "c"
            | "h"
            | "cpp"
            | "hpp"
            | "java"
            | "go"
            | "rb"
            | "php"
            | "tex"
            | "r"
            | "gitignore"
    );
    let display_path = path
        .to_string_lossy()
        .strip_prefix("\\\\?\\")
        .unwrap_or(&path.to_string_lossy())
        .to_string();
    let mut result = json!({"path":display_path,"name":path.file_name().unwrap_or_default().to_string_lossy(),"extension":ext,"size":metadata.len(),"kind":"unsupported"});
    let media = match ext.as_str() {
        "pdf" => Some("pdf"),
        "mp4" | "webm" | "mov" | "m4v" => Some("video"),
        "mp3" | "wav" | "ogg" => Some("audio"),
        _ => None,
    };
    if let Some(kind) = media {
        result["kind"] = json!(kind);
        return Ok(result);
    }
    if mime.is_none() && !text {
        return Ok(result);
    }
    let limit = if mime.is_some() {
        10 * 1024 * 1024
    } else {
        2 * 1024 * 1024
    };
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > limit {
        result["reason"] = json!("文件较大，请使用系统应用打开（文本上限 2 MB，图片上限 10 MB）");
        return Ok(result);
    }
    if let Some(mime) = mime {
        result["kind"] = json!("image");
        result["mime"] = json!(mime);
        result["bytes"] = json!(bytes);
    } else {
        let content = String::from_utf8(bytes)
            .map_err(|_| "当前仅支持 UTF-8 文本，请使用系统应用打开".to_string())?;
        if content.contains('\0') {
            return Err("该文件不是可预览的文本".into());
        }
        result["kind"] = json!("text");
        result["content"] = json!(content);
    }
    Ok(result)
}

#[tauri::command]
pub async fn grok_preview_file(
    app: tauri::AppHandle,
    path: String,
    cwd: String,
) -> Result<Value, String> {
    let value = tauri::async_runtime::spawn_blocking(move || preview(&path, &cwd))
        .await
        .map_err(|e| e.to_string())??;
    if matches!(value["kind"].as_str(), Some("pdf" | "video" | "audio")) {
        app.asset_protocol_scope()
            .allow_file(value["path"].as_str().ok_or("文件路径缺失")?)
            .map_err(|e| e.to_string())?;
    }
    Ok(value)
}

#[tauri::command]
pub async fn grok_open_file(path: String, cwd: String, folder: bool) -> Result<(), String> {
    let path = resolve(&path, &cwd)?;
    let target = if folder && path.is_file() {
        path.parent().ok_or("找不到文件夹")?.to_path_buf()
    } else {
        path
    };
    // Opening a file is an explicit user action; executables are never launched here.
    if !folder
        && !matches!(
            target
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase()
                .as_str(),
            "mp4"
                | "webm"
                | "mov"
                | "m4v"
                | "mp3"
                | "wav"
                | "ogg"
                | "md"
                | "txt"
                | "pdf"
                | "png"
                | "jpg"
                | "jpeg"
                | "gif"
                | "webp"
                | "bmp"
                | "doc"
                | "docx"
                | "ppt"
                | "pptx"
                | "xls"
                | "xlsx"
                | "csv"
                | "json"
                | "log"
        )
    {
        return Err("此类型请通过“打开文件夹”选择编辑器打开".into());
    }
    #[cfg(target_os = "windows")]
    let mut command = std::process::Command::new("explorer.exe");
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let mut command = std::process::Command::new("xdg-open");
    let target_text = target.to_string_lossy();
    let target_arg = target_text.strip_prefix("\\\\?\\").unwrap_or(&target_text);
    command
        .arg(target_arg)
        .spawn()
        .map_err(|e| format!("打开失败：{e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn local_preview_handles_unicode_missing_binary_and_size() {
        let root = std::env::temp_dir().join(format!("grok-preview-test-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("中文 文件.md"), "# 示例\n公式 $x^2$").unwrap();
        let value = preview("中文 文件.md", root.to_str().unwrap()).unwrap();
        assert_eq!(value["kind"], "text");
        assert!(value["content"].as_str().unwrap().contains("公式"));
        assert!(preview("missing.md", root.to_str().unwrap()).is_err());
        fs::write(root.join("demo.exe"), [0, 1, 2]).unwrap();
        assert_eq!(
            preview("demo.exe", root.to_str().unwrap()).unwrap()["kind"],
            "unsupported"
        );
        fs::write(root.join("large.txt"), vec![b'x'; 2 * 1024 * 1024 + 1]).unwrap();
        assert_eq!(
            preview("large.txt", root.to_str().unwrap()).unwrap()["kind"],
            "unsupported"
        );
        for (name, kind) in [
            ("中文 报告.pdf", "pdf"),
            ("video.mp4", "video"),
            ("sound.wav", "audio"),
        ] {
            fs::write(root.join(name), [0, 1, 2]).unwrap();
            let value = preview(name, root.to_str().unwrap()).unwrap();
            assert_eq!(value["kind"], kind);
            assert!(value.get("bytes").is_none()); // Media is served on demand, not copied through IPC.
        }
        fs::remove_dir_all(root).unwrap();
    }
}
