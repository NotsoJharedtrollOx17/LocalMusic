use base64::Engine;
use music_core::{normalize, Track};
use std::path::{Path, PathBuf};
pub fn identity(t: &Track) -> String {
    if t.album.trim().is_empty() {
        t.id.clone()
    } else {
        normalize(&format!("{}|{}", t.artist, t.album))
    }
}
pub fn resolve(
    track: &Track,
    size: u32,
    cache: &Path,
    app: &tauri::AppHandle,
) -> Result<String, String> {
    let size = if size <= 64 {
        64
    } else if size <= 128 {
        128
    } else {
        512
    };
    let id = identity(track);
    let mut h = 2166136261u32;
    for c in format!("cover-v1:{id}").chars() {
        h = (h ^ (c as u32)).wrapping_mul(16777619)
    }
    let seed = format!("{h:08x}");
    let key = track
        .artwork_url
        .as_deref()
        .and_then(|s| s.strip_prefix("cache:"))
        .unwrap_or(&seed);
    let mut path = cache.join(format!("{key}-{size}.png"));
    if size == 128 {
        let _ = derive_row_cover(cache, key);
    }
    if !path.exists() && key != seed {
        #[cfg(not(target_os = "android"))]
        {
            use lofty::file::TaggedFileExt;
            let _ = app;
            if let Ok(tagged) = lofty::read_from_path(&track.source_uri) {
                if let Some(picture) = tagged
                    .primary_tag()
                    .or_else(|| tagged.first_tag())
                    .and_then(|tag| tag.pictures().first())
                {
                    let _ = save_embedded(picture.data(), cache);
                }
            }
        }
        #[cfg(target_os = "android")]
        {
            use tauri_plugin_native_music::NativeMusicExt;
            let _: Result<serde_json::Value, String> = app
                .native_music()
                .call("artwork", serde_json::json!({"uri":track.source_uri}));
        }
        if size == 128 {
            let _ = derive_row_cover(cache, key);
        }
        if !path.exists() {
            path = cache.join(format!("{seed}-{size}.png"));
        }
    }
    if !path.exists() {
        std::fs::create_dir_all(cache).map_err(|e| e.to_string())?;
        procedural(h, size).save(&path).map_err(|e| e.to_string())?;
        let _ = prune(cache, 128 * 1024 * 1024, Some(&path));
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}
fn derive_row_cover(cache: &Path, key: &str) -> Result<(), String> {
    let destination = cache.join(format!("{key}-128.png"));
    if !destination.exists() {
        let source = cache.join(format!("{key}-512.png"));
        if source.exists() {
            image::open(source)
                .map_err(|e| e.to_string())?
                .thumbnail(128, 128)
                .save(destination)
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
pub fn save_embedded(bytes: &[u8], cache: &Path) -> Result<String, String> {
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("Artwork too large".into());
    }
    let mut reader = image::ImageReader::new(std::io::Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(32 * 1024 * 1024);
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    reader.limits(limits);
    let image = reader.decode().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(cache).map_err(|e| e.to_string())?;
    let key = blake3::hash(bytes).to_hex().to_string();
    for size in [64, 128, 512] {
        let path = cache.join(format!("{key}-{size}.png"));
        if !path.exists() {
            image
                .thumbnail(size, size)
                .save(&path)
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(format!("cache:{key}"))
}
pub fn prune(cache: &Path, budget: u64, keep: Option<&Path>) -> Result<(), String> {
    let mut files = std::fs::read_dir(cache)
        .map_err(|e| e.to_string())?
        .filter_map(|x| x.ok())
        .filter_map(|x| {
            let p = x.path();
            let m = x.metadata().ok()?;
            if !m.is_file() || p.extension().and_then(|x| x.to_str()) != Some("png") {
                return None;
            }
            Some((p, m.len(), m.modified().ok()))
        })
        .collect::<Vec<_>>();
    let mut total: u64 = files.iter().map(|x| x.1).sum();
    files.sort_by_key(|x| x.2);
    for (p, size, _) in files {
        if total <= budget {
            break;
        }
        if keep == Some(p.as_path()) {
            continue;
        }
        std::fs::remove_file(&p).map_err(|e| e.to_string())?;
        total = total.saturating_sub(size);
    }
    Ok(())
}
fn procedural(seed: u32, size: u32) -> image::RgbaImage {
    let palettes = [
        [[240, 232, 216], [238, 91, 18], [33, 43, 52], [96, 123, 140]],
        [
            [23, 36, 44],
            [232, 104, 33],
            [231, 219, 196],
            [69, 111, 136],
        ],
        [
            [233, 229, 216],
            [63, 105, 122],
            [237, 106, 43],
            [41, 56, 62],
        ],
        [
            [34, 31, 34],
            [201, 186, 160],
            [237, 98, 25],
            [101, 115, 113],
        ],
    ];
    let p = palettes[(seed % 4) as usize];
    let mut image = image::RgbaImage::new(size, size);
    let cx = (110 + seed % 180) as f64;
    let cy = (140 + (seed >> 8) % 210) as f64;
    let radius = (85 + seed % 70) as f64;
    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let xx = (x as f64 + 0.5) * 512. / size as f64;
        let yy = (y as f64 + 0.5) * 512. / size as f64;
        let mut c = p[0];
        let d = ((xx - cx).powi(2) + (yy - cy).powi(2)).sqrt();
        if d < radius {
            c = p[1]
        }
        if yy > 390. - xx * 160. / 512. {
            c = p[2]
        }
        if (xx - 398.).powi(2) + (yy - 112.).powi(2) < 37f64.powi(2) {
            c = p[3]
        }
        if (xx - 64.).abs() < 1.
            || (xx - 90.).abs() < 1.
            || (yy - (110. + (xx - 24.) * 270. / 466.)).abs() < 1.
            || (d - radius - 22.).abs() < 1.
        {
            c = p[3]
        }
        if (373.0..381.0).contains(&xx) && (330.0..431.0).contains(&yy) {
            c = p[1]
        }
        *pixel = image::Rgba([c[0], c[1], c[2], 255]);
    }
    image
}
pub fn cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    app.path()
        .app_data_dir()
        .map(|p| p.join("artwork"))
        .map_err(|e| e.to_string())
}
pub fn decorate(mut t: Track, cache: &Path, app: &tauri::AppHandle) -> Track {
    if let Ok(url) = resolve(&t, 128, cache, app) {
        t.artwork_url = Some(url)
    }
    t
}
#[cfg(test)]
mod tests {
    #[test]
    fn embedded_covers_support_cards_and_legacy_row_cache() {
        use image::{DynamicImage, ImageFormat};
        let cache =
            std::env::temp_dir().join(format!("local-music-cover-test-{}", uuid::Uuid::new_v4()));
        let source = DynamicImage::ImageRgba8(image::RgbaImage::from_pixel(
            640,
            640,
            image::Rgba([20, 100, 180, 255]),
        ));
        let mut bytes = std::io::Cursor::new(Vec::new());
        source.write_to(&mut bytes, ImageFormat::Png).unwrap();
        let reference = super::save_embedded(bytes.get_ref(), &cache).unwrap();
        let key = reference.strip_prefix("cache:").unwrap();
        for size in [64, 128, 512] {
            let image = image::open(cache.join(format!("{key}-{size}.png"))).unwrap();
            assert_eq!(image.width(), size);
            assert_eq!(image.height(), size);
        }
        std::fs::remove_file(cache.join(format!("{key}-128.png"))).unwrap();
        super::derive_row_cover(&cache, key).unwrap();
        let row = image::open(cache.join(format!("{key}-128.png"))).unwrap();
        assert_eq!(row.width(), 128);
        std::fs::remove_dir_all(cache).unwrap();
    }

    #[test]
    fn deterministic_pixels() {
        let image = super::procedural(123, 64);
        assert_eq!(image.dimensions(), (64, 64));
        assert!(image.pixels().all(|p| p[3] == 255));
        assert_ne!(
            super::procedural(123, 64).into_raw(),
            super::procedural(124, 64).into_raw()
        );
    }
}
