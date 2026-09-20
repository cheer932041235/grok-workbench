use std::{env, fs, path::PathBuf};

fn package_version() -> String {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set"));
    let package_json = fs::read_to_string(manifest_dir.join("../package.json"))
        .expect("package.json must be readable");
    let key = "\"version\"";
    let value = package_json
        .find(key)
        .and_then(|index| package_json[index + key.len()..].split_once(':'))
        .map(|(_, value)| value.trim())
        .and_then(|value| value.strip_prefix('"'))
        .and_then(|value| value.split_once('"').map(|(version, _)| version))
        .filter(|version| !version.is_empty())
        .expect("package.json must contain a non-empty version")
        .to_owned();
    value
}

fn main() {
    println!("cargo:rerun-if-changed=../package.json");
    println!(
        "cargo:rustc-env=GROK_WORKBENCH_VERSION={}",
        package_version()
    );
    tauri_build::build()
}
