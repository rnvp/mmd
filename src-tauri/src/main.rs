#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    env, fs,
    path::{Path, PathBuf},
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;

#[derive(Serialize)]
struct FilePayload {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InsertableImage {
    absolute_path: String,
    relative_path: String,
    file_name: String,
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

fn mime_type_from_path(path: &str) -> &'static str {
    match PathBuf::from(path)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        Some("avif") => "image/avif",
        _ => "application/octet-stream",
    }
}

fn is_supported_image_path(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" | "avif")
    )
}

fn to_relative_markdown_path(base_dir: &Path, path: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(base_dir)
        .map_err(|error| error.to_string())?;
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

fn push_image_if_valid(images: &mut Vec<InsertableImage>, base_dir: &Path, path: PathBuf) -> Result<(), String> {
    if !path.is_file() || !is_supported_image_path(&path) {
        return Ok(());
    }

    let relative_path = to_relative_markdown_path(base_dir, &path)?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("image")
        .to_string();

    images.push(InsertableImage {
        absolute_path: path.to_string_lossy().to_string(),
        relative_path,
        file_name,
    });

    Ok(())
}

fn collect_images_from_img_dir(images: &mut Vec<InsertableImage>, base_dir: &Path, current_dir: &Path) -> Result<(), String> {
    for entry in fs::read_dir(current_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            collect_images_from_img_dir(images, base_dir, &path)?;
            continue;
        }

        push_image_if_valid(images, base_dir, path)?;
    }

    Ok(())
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
fn read_image_data_url(path: String) -> Result<String, String> {
    let bytes = fs::read(PathBuf::from(&path)).map_err(|error| error.to_string())?;
    let encoded = STANDARD.encode(bytes);
    Ok(format!("data:{};base64,{}", mime_type_from_path(&path), encoded))
}

#[tauri::command]
fn list_insertable_images(document_path: String) -> Result<Vec<InsertableImage>, String> {
    let document_path = PathBuf::from(document_path);
    let base_dir = document_path
        .parent()
        .ok_or_else(|| "Document directory not found".to_string())?;

    let mut images = Vec::new();

    for entry in fs::read_dir(base_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_file() {
            push_image_if_valid(&mut images, base_dir, path)?;
        }
    }

    let img_dir = base_dir.join("img");
    if img_dir.is_dir() {
        collect_images_from_img_dir(&mut images, base_dir, &img_dir)?;
    }

    images.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
    images.dedup_by(|left, right| left.relative_path == right.relative_path);

    Ok(images)
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
            read_image_data_url,
            list_insertable_images,
            get_launch_file_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
