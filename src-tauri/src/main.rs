#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{env, fs, path::PathBuf};

use serde::Serialize;

#[derive(Serialize)]
struct FilePayload {
    path: String,
    content: String,
}

fn normalize_utf8(input: String) -> String {
    input.strip_prefix('\u{feff}').unwrap_or(&input).to_string()
}

fn is_supported_text_path(path: &str) -> bool {
    matches!(
        PathBuf::from(path)
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("md" | "markdown" | "txt")
    )
}

#[tauri::command]
fn read_text_file(path: String) -> Result<FilePayload, String> {
    let path_buf = PathBuf::from(&path);
    let content = fs::read_to_string(&path_buf).map_err(|error| error.to_string())?;
    Ok(FilePayload {
        path,
        content: normalize_utf8(content),
    })
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(PathBuf::from(path), content.as_bytes()).map_err(|error| error.to_string())
}

#[tauri::command]
fn get_launch_file_path() -> Option<String> {
    env::args()
        .skip(1)
        .find(|arg| is_supported_text_path(arg) && PathBuf::from(arg).is_file())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            get_launch_file_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
