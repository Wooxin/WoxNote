use crate::canonical_existing_dir;
use std::{fs, io::Cursor};

#[tauri::command]
pub fn paste_image(root: String, data_url: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    use image::GenericImageView;

    let base64_data = data_url.split(',').nth(1).ok_or("Invalid data URL")?;
    let ext = if data_url.contains("image/png") {
        "png"
    } else if data_url.contains("image/jpeg") || data_url.contains("image/jpg") {
        "jpg"
    } else if data_url.contains("image/webp") {
        "webp"
    } else if data_url.contains("image/gif") {
        "gif"
    } else {
        "png"
    };

    let bytes = STANDARD.decode(base64_data).map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let (w, h) = img.dimensions();
    let img = if w > 1200 {
        let ratio = 1200.0 / w as f64;
        img.resize(
            1200,
            (h as f64 * ratio) as u32,
            image::imageops::FilterType::Lanczos3,
        )
    } else {
        img
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let filename = format!("paste-{}.{}", now, ext);
    let root_path = canonical_existing_dir(&root)?;
    let images_dir = root_path.join("images");
    fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;
    let output_path = images_dir.join(&filename);

    let mut buf = Vec::new();
    img.write_to(
        &mut Cursor::new(&mut buf),
        if ext == "png" || ext == "gif" {
            image::ImageFormat::Png
        } else {
            image::ImageFormat::Jpeg
        },
    )
    .map_err(|e| e.to_string())?;
    fs::write(&output_path, buf).map_err(|e| e.to_string())?;
    Ok(format!("images/{}", filename))
}
