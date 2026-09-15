use super::{record_path, save, valid_id};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

struct Source {
    path: PathBuf,
    summary: Value,
}

fn sources(
    sessions: &Path,
    warnings: &mut Vec<String>,
) -> Result<BTreeMap<String, Source>, String> {
    let mut records = BTreeMap::new();
    // Grok stores one folder per working directory, then one folder per session.
    for project in std::fs::read_dir(sessions).map_err(|e| e.to_string())? {
        let project = project.map_err(|e| e.to_string())?.path();
        if !project.is_dir() {
            continue;
        }
        let entries = match std::fs::read_dir(&project) {
            Ok(entries) => entries,
            Err(error) => {
                warnings.push(format!("无法读取一个 Grok 项目目录：{error}"));
                continue;
            }
        };
        for entry in entries {
            let path = entry.map_err(|e| e.to_string())?.path();
            if !path.is_dir() || !path.join("summary.json").is_file() {
                continue;
            }
            let record = super::read_json(&path.join("summary.json"));
            match record {
                Ok(summary)
                    if summary["info"]["id"].as_str().is_some_and(valid_id)
                        && summary["info"]["cwd"].is_string()
                        && summary["updated_at"].is_string() =>
                {
                    records.insert(
                        summary["info"]["id"].as_str().unwrap().to_string(),
                        Source { path, summary },
                    );
                }
                _ => warnings.push(format!(
                    "{}：Grok 会话摘要损坏或字段不完整，已跳过",
                    path.file_name().unwrap_or_default().to_string_lossy()
                )),
            }
        }
    }
    Ok(records)
}

fn read_events(source: &Source) -> Result<Vec<Value>, String> {
    let file = std::fs::File::open(source.path.join("updates.jsonl"))
        .map_err(|e| format!("无法读取 updates.jsonl：{e}"))?;
    let mut events = Vec::new();
    for (line_index, line) in BufReader::new(file).lines().enumerate() {
        let line = line.map_err(|e| e.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        let event: Value = serde_json::from_str(&line)
            .map_err(|_| format!("updates.jsonl 第 {} 行不完整，已跳过会话", line_index + 1))?;
        if event["method"].is_string() && event["params"]["update"].is_object() {
            events.push(event);
        }
    }
    if events.is_empty() {
        return Err("updates.jsonl 没有可显示的会话事件".into());
    }
    Ok(events)
}

fn session_events(
    id: &str,
    sources: &BTreeMap<String, Source>,
    warnings: &mut Vec<String>,
) -> Result<Vec<Value>, String> {
    let mut events = read_events(&sources[id])?;
    let mut visited = BTreeSet::from([id.to_string()]);
    let mut offset = 0;
    while offset < events.len() {
        let child = events[offset]["params"]["update"]["child_session_id"]
            .as_str()
            .map(str::to_owned);
        offset += 1;
        let Some(child) = child.filter(|child| visited.insert(child.clone())) else {
            continue;
        };
        match sources.get(&child).map(read_events) {
            Some(Ok(child_events)) => events.extend(child_events),
            Some(Err(error)) => warnings.push(format!("{id} 的子任务 {child}：{error}")),
            None => warnings.push(format!(
                "{id} 的子任务 {child} 缺少本机记录，仅保留父会话事件"
            )),
        }
    }
    events.sort_by(|a, b| a["timestamp"].as_str().cmp(&b["timestamp"].as_str()));
    Ok(events)
}

/// Copy local CLI/TUI history without changing source files or replacing workbench records.
/// Imported ACP events are converted by the frontend's shared session event parser on first open.
pub fn import_grok(dir: &Path, grok_home: &Path) -> Result<Value, String> {
    let sessions = grok_home.join("sessions");
    if !sessions.is_dir() {
        return Err(format!("没有找到 Grok 历史目录：{}", sessions.display()));
    }
    let mut warnings = Vec::new();
    let sources = sources(&sessions, &mut warnings)?;
    let mut imported = 0;
    let mut skipped = 0;
    for (id, source) in &sources {
        if source.summary["session_kind"]
            .as_str()
            .is_some_and(|kind| kind.starts_with("subagent"))
        {
            continue;
        }
        if record_path(dir, id)?.exists() {
            skipped += 1;
            continue;
        }
        let events = match session_events(id, &sources, &mut warnings) {
            Ok(events) => events,
            Err(error) => {
                warnings.push(format!("{id}：{error}"));
                skipped += 1;
                continue;
            }
        };
        let title = source.summary["generated_title"]
            .as_str()
            .filter(|title| !title.trim().is_empty())
            .or_else(|| source.summary["session_summary"].as_str())
            .filter(|title| !title.trim().is_empty())
            .unwrap_or("Grok 历史会话");
        let record = json!({
            "sessionId": id,
            "title": title,
            "cwd": source.summary["info"]["cwd"],
            "updatedAt": source.summary["updated_at"],
            "archived": false,
            "source": "grok-cli",
            "blocks": [],
            "plan": [],
            "importedEvents": events,
        });
        match save(dir, &record) {
            Ok(()) => imported += 1,
            Err(error) => {
                warnings.push(format!("{id}：无法保存导入的会话：{error}"));
                skipped += 1;
            }
        }
    }
    Ok(json!({"imported": imported, "skipped": skipped, "warnings": warnings}))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(grok_home: &Path, id: &str, kind: &str, events: &[Value]) -> PathBuf {
        let path = grok_home.join("sessions/project").join(id);
        std::fs::create_dir_all(&path).unwrap();
        super::super::write_json(
            &path.join("summary.json"),
            &json!({"info":{"id":id,"cwd":"project"},"updated_at":"2026-09-16T01:00:00Z","generated_title":"CLI session","session_kind":kind}),
        )
        .unwrap();
        let lines = events
            .iter()
            .map(Value::to_string)
            .collect::<Vec<_>>()
            .join("\n");
        std::fs::write(path.join("updates.jsonl"), lines).unwrap();
        path
    }

    fn event(id: &str, timestamp: &str, update: Value) -> Value {
        json!({"timestamp":timestamp,"method":"session/update","params":{"sessionId":id,"update":update}})
    }

    #[test]
    fn import_keeps_existing_archive_and_combines_child_events_with_parent() {
        let dir = super::super::tests::test_dir();
        let grok_home = dir.join("source");
        let workbench = dir.join("workbench");
        std::fs::create_dir(&workbench).unwrap();
        let source = fixture(
            &grok_home,
            "root",
            "headless",
            &[
                event(
                    "root",
                    "2026-09-16T01:00:00Z",
                    json!({"sessionUpdate":"user_message_chunk","content":{"type":"text","text":"Build a report"}}),
                ),
                event(
                    "root",
                    "2026-09-16T01:00:01Z",
                    json!({"sessionUpdate":"subagent_spawned","child_session_id":"child","description":"Read files"}),
                ),
                event(
                    "root",
                    "2026-09-16T01:00:04Z",
                    json!({"sessionUpdate":"subagent_finished","child_session_id":"child","status":"completed","output":"Done"}),
                ),
            ],
        );
        fixture(
            &grok_home,
            "child",
            "subagent",
            &[event(
                "child",
                "2026-09-16T01:00:02Z",
                json!({"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"Child output"}}),
            )],
        );
        let original = std::fs::read(source.join("updates.jsonl")).unwrap();
        let result = import_grok(&workbench, &grok_home).unwrap();
        assert_eq!(result["imported"], 1);
        assert_eq!(result["skipped"], 0);
        assert_eq!(result["warnings"], json!([]));
        let mut record = super::super::load_record(&workbench, "root").unwrap();
        assert_eq!(record["importedEvents"].as_array().unwrap().len(), 4);
        assert_eq!(record["importedEvents"][2]["params"]["sessionId"], "child");
        assert!(!workbench.join("child.json").exists());
        assert!(super::super::load(&workbench).unwrap()["records"][0]
            .get("importedEvents")
            .is_none());
        record["title"] = json!("My title");
        record["archived"] = json!(true);
        save(&workbench, &record).unwrap();
        let repeated = import_grok(&workbench, &grok_home).unwrap();
        assert_eq!(repeated["imported"], 0);
        assert_eq!(repeated["skipped"], 1);
        assert_eq!(
            super::super::load_record(&workbench, "root").unwrap(),
            record
        );
        assert_eq!(
            std::fs::read(source.join("updates.jsonl")).unwrap(),
            original
        );
        super::super::tests::clean_test_dir(&dir);
    }

    #[test]
    fn incomplete_source_is_reported_without_importing_partial_conversation() {
        let dir = super::super::tests::test_dir();
        let grok_home = dir.join("source");
        let workbench = dir.join("workbench");
        std::fs::create_dir(&workbench).unwrap();
        let broken = fixture(
            &grok_home,
            "broken",
            "headless",
            &[event(
                "broken",
                "2026-09-16T01:00:00Z",
                json!({"sessionUpdate":"user_message_chunk","content":{"type":"text","text":"hello"}}),
            )],
        );
        use std::io::Write;
        std::fs::OpenOptions::new()
            .append(true)
            .open(broken.join("updates.jsonl"))
            .unwrap()
            .write_all(b"\n{unfinished")
            .unwrap();
        let absent = fixture(&grok_home, "absent", "headless", &[]);
        std::fs::remove_file(absent.join("updates.jsonl")).unwrap();
        let result = import_grok(&workbench, &grok_home).unwrap();
        assert_eq!(result["imported"], 0);
        assert_eq!(result["skipped"], 2);
        assert_eq!(result["warnings"].as_array().unwrap().len(), 2);
        assert_eq!(std::fs::read_dir(&workbench).unwrap().count(), 0);
        assert!(broken.join("updates.jsonl").exists());
        super::super::tests::clean_test_dir(&dir);
    }
}
