use serde_json::{json, Value};
use std::path::{Path, PathBuf};

mod cli_import;
pub use cli_import::import_grok;

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn record_path(dir: &Path, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err("会话 ID 无效".into());
    }
    Ok(dir.join(format!("{id}.json")))
}

fn validate_record(record: &Value) -> Result<(), String> {
    if !["sessionId", "title", "cwd", "updatedAt"]
        .iter()
        .all(|key| record[*key].is_string())
        || !record["blocks"].is_array()
        || !record["plan"].is_array()
        || !valid_id(record["sessionId"].as_str().unwrap_or_default())
    {
        return Err("缺少必要的会话字段".into());
    }
    Ok(())
}

fn read_json(path: &Path) -> Result<Value, String> {
    let data = std::fs::read(path).map_err(|e| e.to_string())?;
    serde_json::from_slice(&data).map_err(|e| e.to_string())
}

fn summary(record: &Value) -> Value {
    let mut item = json!({
        "sessionId": record["sessionId"],
        "title": record["title"],
        "cwd": record["cwd"],
        "updatedAt": record["updatedAt"],
        "archived": record["archived"].as_bool().unwrap_or(false),
    });
    if let Some(source) = record["source"].as_str() {
        item["source"] = json!(source);
    }
    item
}

fn save_summary(dir: &Path, record: &Value) -> Result<(), String> {
    let summaries = dir.join("summaries");
    std::fs::create_dir_all(&summaries).map_err(|e| e.to_string())?;
    write_json(
        &record_path(&summaries, record["sessionId"].as_str().unwrap())?,
        &summary(record),
    )
}

pub fn save(dir: &Path, record: &Value) -> Result<(), String> {
    validate_record(record)?;
    let path = record_path(dir, record["sessionId"].as_str().unwrap())?;
    write_json(&path, record)?;
    save_summary(dir, record)
}

pub fn write_json(path: &Path, record: &Value) -> Result<(), String> {
    let data = serde_json::to_vec_pretty(record).map_err(|e| e.to_string())?;
    let pending = path.with_extension("json.tmp");
    std::fs::write(&pending, data).map_err(|e| e.to_string())?;
    std::fs::rename(pending, path).map_err(|e| e.to_string())
}

pub fn load_draft(path: &Path) -> Result<Option<Value>, String> {
    match std::fs::read(path) {
        Ok(data) => serde_json::from_slice(&data)
            .map(Some)
            .map_err(|e| e.to_string()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn load_record(dir: &Path, id: &str) -> Result<Value, String> {
    let record = read_json(&record_path(dir, id)?)?;
    validate_record(&record)?;
    if record["sessionId"].as_str() != Some(id) {
        return Err("历史文件与会话 ID 不一致".into());
    }
    Ok(record)
}

/// The list reads small summaries; transcript bodies and image data are loaded on demand.
/// Existing records receive a summary on their first visit to the list.
pub fn load(dir: &Path) -> Result<Value, String> {
    let mut records = Vec::new();
    let mut warnings = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().is_none_or(|e| e != "json") || !path.is_file() {
            continue;
        }
        let id = path
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or_default();
        let cached_path = dir.join("summaries").join(format!("{id}.json"));
        let current = std::fs::metadata(&path).and_then(|meta| meta.modified());
        let cached = std::fs::metadata(&cached_path).and_then(|meta| meta.modified());
        let cached_record = match (current, cached) {
            (Ok(current), Ok(cached)) if cached >= current => read_json(&cached_path).ok(),
            _ => None,
        };
        if let Some(record) = cached_record.filter(|record| {
            record["sessionId"].as_str() == Some(id)
                && ["title", "cwd", "updatedAt"]
                    .iter()
                    .all(|key| record[*key].is_string())
        }) {
            records.push(summary(&record));
            continue;
        }
        match load_record(dir, id) {
            Ok(record) => {
                if let Err(error) = save_summary(dir, &record) {
                    warnings.push(format!("{id}：无法保存历史摘要：{error}"));
                }
                records.push(summary(&record));
            }
            Err(error) => warnings.push(format!("{id}：{error}")),
        }
    }
    records.sort_by(|a, b| b["updatedAt"].as_str().cmp(&a["updatedAt"].as_str()));
    Ok(json!({"records": records, "warnings": warnings}))
}

pub fn grok_home() -> Result<PathBuf, String> {
    if let Some(path) = std::env::var_os("GROK_HOME").filter(|path| !path.is_empty()) {
        return Ok(PathBuf::from(path));
    }
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
        .map(|home| PathBuf::from(home).join(".grok"))
        .ok_or_else(|| "找不到本机 Grok 历史目录，请设置 GROK_HOME".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static NEXT_TEST: AtomicUsize = AtomicUsize::new(0);

    pub(super) fn test_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "grok-history-test-{}-{}",
            std::process::id(),
            NEXT_TEST.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    pub(super) fn clean_test_dir(dir: &Path) {
        let resolved = dir.canonicalize().unwrap();
        let temp = std::env::temp_dir().canonicalize().unwrap();
        assert_eq!(resolved.parent(), Some(temp.as_path()));
        assert!(resolved
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("grok-history-test-"));
        std::fs::remove_dir_all(resolved).unwrap();
    }

    fn record() -> Value {
        json!({"sessionId":"session-1","title":"First","cwd":"project","updatedAt":"2026-09-16T00:00:00Z","blocks":[{"type":"user","text":"hello","images":[{"data":"aGVsbG8=","mimeType":"image/png","name":"demo.png"}]}],"plan":[]})
    }

    #[test]
    fn summaries_exclude_bodies_and_load_full_record_only_on_demand() {
        let dir = test_dir();
        let mut record = record();
        // Pre-existing installations have full records without summaries.
        write_json(&dir.join("session-1.json"), &record).unwrap();
        let result = load(&dir).unwrap();
        assert!(result["records"][0].get("blocks").is_none());
        assert!(dir.join("summaries/session-1.json").exists());
        assert_eq!(load_record(&dir, "session-1").unwrap(), record);
        record["title"] = json!("Renamed");
        record["archived"] = json!(true);
        save(&dir, &record).unwrap();
        let result = load(&dir).unwrap();
        assert_eq!(result["records"][0]["title"], "Renamed");
        assert_eq!(result["records"][0]["archived"], true);
        // A full record changed outside save() invalidates an older summary.
        record["title"] = json!("Externally updated");
        write_json(&dir.join("session-1.json"), &record).unwrap();
        let cached = std::fs::File::options()
            .write(true)
            .open(dir.join("summaries/session-1.json"))
            .unwrap();
        cached
            .set_times(std::fs::FileTimes::new().set_modified(std::time::UNIX_EPOCH))
            .unwrap();
        drop(cached);
        assert_eq!(
            load(&dir).unwrap()["records"][0]["title"],
            "Externally updated"
        );
        // Broken cached metadata is rebuilt from the still-readable original record.
        std::fs::write(dir.join("summaries/session-1.json"), b"{").unwrap();
        assert_eq!(
            load(&dir).unwrap()["records"][0]["title"],
            "Externally updated"
        );
        assert_eq!(load_record(&dir, "session-1").unwrap(), record);
        assert!(!dir.join("session-1.json.tmp").exists());
        clean_test_dir(&dir);
    }

    #[test]
    fn damaged_record_does_not_hide_good_records_or_modify_source() {
        let dir = test_dir();
        save(&dir, &record()).unwrap();
        std::fs::write(dir.join("broken.json"), b"{truncated").unwrap();
        std::fs::write(dir.join("invalid.json"), b"null").unwrap();
        let result = load(&dir).unwrap();
        assert_eq!(result["records"].as_array().unwrap().len(), 1);
        assert_eq!(result["warnings"].as_array().unwrap().len(), 2);
        assert_eq!(
            std::fs::read(dir.join("broken.json")).unwrap(),
            b"{truncated"
        );
        assert!(load_record(&dir, "../session-1").is_err());
        assert!(load_record(&dir, "broken").is_err());
        clean_test_dir(&dir);
    }

    #[test]
    fn draft_restores_text_and_images() {
        let dir = test_dir();
        let path = dir.join("draft.data");
        assert_eq!(load_draft(&path).unwrap(), None);
        let draft = json!({"text":"未发送的图片", "images":[{"data":"aGVsbG8=", "name":"demo.png", "mimeType":"image/png"}]});
        write_json(&path, &draft).unwrap();
        assert_eq!(load_draft(&path).unwrap(), Some(draft));
        clean_test_dir(&dir);
    }
}
