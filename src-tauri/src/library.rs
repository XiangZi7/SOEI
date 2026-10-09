use crate::{
    model::{AppError, AppResult, Track},
    AppState,
};
use lofty::{
    file::{AudioFile, TaggedFileExt},
    probe::Probe,
    tag::Accessor,
};
use serde::Serialize;
use std::{
    path::{Path, PathBuf},
    sync::atomic::Ordering,
};
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub running: bool,
    pub scanned: usize,
    pub imported: usize,
    pub errors: Vec<String>,
    pub cancelled: bool,
}

pub fn supported(path: &Path) -> bool {
    path.extension()
        .and_then(|part| part.to_str())
        .is_some_and(|part| {
            ["mp3", "flac", "wav", "ogg", "m4a", "aac"]
                .contains(&part.to_ascii_lowercase().as_str())
        })
}

fn read_track(path: &Path, cache: &Path) -> AppResult<Track> {
    let canonical = path.canonicalize()?;
    let id = blake3::hash(canonical.to_string_lossy().to_lowercase().as_bytes())
        .to_hex()
        .to_string();
    let media = Probe::open(&canonical)
        .map_err(|error| AppError::new("METADATA", error))?
        .read()
        .map_err(|error| AppError::new("METADATA", error))?;
    let tag = media.primary_tag().or_else(|| media.first_tag());
    let title = tag
        .and_then(|tag| tag.title().map(|value| value.into_owned()))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned()
        });
    let mut cover_ref = None;
    if let Some(picture) = tag.and_then(|tag| tag.pictures().first()) {
        if picture.data().len() <= 20 * 1024 * 1024 {
            if let Ok(image) = image::load_from_memory(picture.data()) {
                let destination = cache.join(format!("{id}.jpg"));
                if image
                    .thumbnail(1200, 1200)
                    .to_rgb8()
                    .save(&destination)
                    .is_ok()
                {
                    cover_ref = Some(destination.to_string_lossy().into_owned());
                }
            }
        }
    }
    let lyric_path = canonical.with_extension("lrc");
    Ok(Track {
        id,
        local_path: canonical.to_string_lossy().into_owned(),
        title,
        artist: tag
            .and_then(|tag| tag.artist().map(|value| value.into_owned()))
            .unwrap_or_else(|| "未知歌手".into()),
        album: tag
            .and_then(|tag| tag.album().map(|value| value.into_owned()))
            .unwrap_or_else(|| "未分类".into()),
        duration_ms: media.properties().duration().as_millis() as u64,
        cover_ref,
        lyric_ref: lyric_path
            .is_file()
            .then(|| lyric_path.to_string_lossy().into_owned()),
        favorite: false,
        last_played: None,
    })
}

pub fn scan(app: AppHandle, paths: Vec<PathBuf>) {
    let state = app.state::<AppState>();
    let mut progress = ScanProgress {
        running: true,
        scanned: 0,
        imported: 0,
        errors: vec![],
        cancelled: false,
    };
    for selected in paths {
        let files: Box<dyn Iterator<Item = Result<PathBuf, String>>> = if selected.is_dir() {
            Box::new(
                WalkDir::new(selected)
                    .follow_links(false)
                    .into_iter()
                    .filter_map(|entry| match entry {
                        Ok(entry) if entry.file_type().is_file() => {
                            Some(Ok(entry.path().to_path_buf()))
                        }
                        Ok(_) => None,
                        Err(error) => Some(Err(error.to_string())),
                    }),
            )
        } else {
            Box::new(std::iter::once(Ok(selected)))
        };
        for entry in files {
            if state.scan_cancel.load(Ordering::Relaxed) {
                progress.cancelled = true;
                break;
            }
            let path = match entry {
                Ok(path) => path,
                Err(error) => {
                    progress.errors.push(error);
                    continue;
                }
            };
            if !supported(&path) {
                continue;
            }
            progress.scanned += 1;
            match read_track(&path, &state.cache_dir) {
                Ok(mut track) => {
                    if let Ok(existing) = state.storage.track(&track.id) {
                        track.favorite = existing.favorite;
                        track.last_played = existing.last_played;
                        if existing.lyric_ref.is_some() {
                            track.lyric_ref = existing.lyric_ref;
                        }
                    }
                    match state.storage.save_track(&track) {
                        Ok(()) => {
                            if let Some(cover) = &track.cover_ref {
                                let _ = app.asset_protocol_scope().allow_file(cover);
                            }
                            progress.imported += 1;
                            let _ = app.emit_to("main", "library:track", &track);
                        }
                        Err(error) => {
                            progress
                                .errors
                                .push(format!("{}: {}", path.display(), error.message))
                        }
                    }
                }
                Err(error) => {
                    progress
                        .errors
                        .push(format!("{}: {}", path.display(), error.message))
                }
            }
            if progress.errors.len() > 100 {
                progress.errors.remove(0);
            }
            if progress.scanned.is_multiple_of(5) {
                let _ = app.emit_to("main", "library:scan-progress", &progress);
            }
        }
        if progress.cancelled {
            break;
        }
    }
    progress.running = false;
    state.scan_busy.store(false, Ordering::Release);
    let _ = app.emit_to("main", "library:scan-progress", progress);
}

pub fn read_lyrics(track: &Track) -> AppResult<Option<String>> {
    let Some(path) = &track.lyric_ref else {
        return Ok(None);
    };
    if std::fs::metadata(path)?.len() > 2 * 1024 * 1024 {
        return Err(AppError::new("LYRIC_SIZE", "歌词文件超过 2 MB"));
    }
    std::fs::read_to_string(path).map(Some).map_err(|error| {
        AppError::new(
            "LYRIC_ENCODING",
            format!("请使用 UTF-8 编码的歌词：{error}"),
        )
    })
}

pub fn create_test_track(directory: &Path, cache: &Path) -> AppResult<Track> {
    std::fs::create_dir_all(directory)?;
    let audio = directory.join("soei-test.wav");
    let wav = include_bytes!("../../public/demo/soei-test.wav").as_slice();
    if std::fs::read(&audio).ok().as_deref() != Some(wav) {
        std::fs::write(&audio, wav)?;
    }
    let lyric_path = audio.with_extension("lrc");
    let lyrics = include_bytes!("../../public/demo/soei-test.lrc").as_slice();
    if std::fs::read(&lyric_path).ok().as_deref() != Some(lyrics) {
        std::fs::write(&lyric_path, lyrics)?;
    }
    let mut track = read_track(&audio, cache)?;
    track.title = "光的回声 · 播放测试".into();
    track.artist = "SOEI".into();
    track.album = "播放与歌词测试".into();
    track.cover_ref = Some("/demo/soei-test-cover.svg".into());
    Ok(track)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bundled_playback_test_has_audio_and_sidecar() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "soei-playback-test-{}-{unique}",
            std::process::id()
        ));
        let track = create_test_track(&directory, &directory).expect("create bundled test");
        assert_eq!(track.duration_ms, 36_000);
        assert_eq!(track.title, "光的回声 · 播放测试");
        let text = read_lyrics(&track).unwrap().unwrap();
        assert!(text.contains("[00:24.00]<00:24.00>拖动进度，"));
        assert_eq!(
            text.as_bytes(),
            include_bytes!("../../public/demo/soei-test.lrc")
        );
        assert_eq!(
            text.lines().filter(|line| line.starts_with("[00:")).count(),
            9
        );
        assert_eq!(
            create_test_track(&directory, &directory).unwrap().id,
            track.id
        );
        std::fs::remove_file(&track.local_path).unwrap();
        std::fs::remove_file(track.lyric_ref.unwrap()).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
    #[test]
    fn unicode_file_index_and_sidecar() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures");
        let track = read_track(&root.join("测试音楽.wav"), &root).expect("index PCM WAV");
        assert_eq!(track.title, "测试音楽");
        assert_eq!(track.duration_ms, 12_000);
        assert!(read_lyrics(&track)
            .unwrap()
            .unwrap()
            .contains("Hello, world."));
        assert_eq!(
            track.id,
            read_track(&root.join("./测试音楽.wav"), &root).unwrap().id
        );
        assert!(read_track(&root.join("损坏.mp3"), &root).is_err());
        assert!(!supported(&root.join("测试音楽.lrc")));
    }
}
