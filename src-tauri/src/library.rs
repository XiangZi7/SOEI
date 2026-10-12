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

pub const LYRIC_EXTENSIONS: &[&str] = &["lrc", "ttml", "yrc", "qrc", "krc", "vtt", "awlrc"];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricFileSource {
    pub name: String,
    pub bytes: Vec<u8>,
}

fn find_lyric_sidecar(audio: &Path) -> Option<PathBuf> {
    let stem = audio.file_stem()?.to_string_lossy();
    let entries = std::fs::read_dir(audio.parent()?).ok()?;
    let mut candidates: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .file_stem()
                    .is_some_and(|part| part.to_string_lossy().eq_ignore_ascii_case(&stem))
                && path
                    .extension()
                    .and_then(|part| part.to_str())
                    .is_some_and(|part| {
                        LYRIC_EXTENSIONS.contains(&part.to_ascii_lowercase().as_str())
                    })
        })
        .collect();
    candidates.sort_by_key(|path| {
        let extension = path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_ascii_lowercase();
        (
            LYRIC_EXTENSIONS
                .iter()
                .position(|part| *part == extension)
                .unwrap_or(usize::MAX),
            path.to_string_lossy().into_owned(),
        )
    });
    candidates.into_iter().next()
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
    let lyric_path = find_lyric_sidecar(&canonical);
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
        lyric_ref: lyric_path.map(|path| path.to_string_lossy().into_owned()),
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

pub fn read_lyrics(track: &Track) -> AppResult<Option<LyricFileSource>> {
    let Some(path) = &track.lyric_ref else {
        return Ok(None);
    };
    if std::fs::metadata(path)?.len() > 2 * 1024 * 1024 {
        return Err(AppError::new("LYRIC_SIZE", "歌词文件超过 2 MB"));
    }
    let bytes = std::fs::read(path)?;
    if bytes.len() > 2 * 1024 * 1024 {
        return Err(AppError::new("LYRIC_SIZE", "歌词文件超过 2 MB"));
    }
    Ok(Some(LyricFileSource {
        name: Path::new(path)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        bytes,
    }))
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
        let source = read_lyrics(&track).unwrap().unwrap();
        let text = String::from_utf8(source.bytes).unwrap();
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
    fn rich_sidecars_and_binary_lyrics_are_preserved() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory =
            std::env::temp_dir().join(format!("soei-rich-lyrics-{}-{unique}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let audio = directory.join("歌曲.wav");
        let ttml = directory.join("歌曲.TTML");
        std::fs::write(&ttml, b"<tt/>").unwrap();
        assert_eq!(find_lyric_sidecar(&audio), Some(ttml.clone()));
        let lrc = directory.join("歌曲.lrc");
        std::fs::write(&lrc, b"[00:01]hello").unwrap();
        assert_eq!(find_lyric_sidecar(&audio), Some(lrc.clone()));
        let binary = directory.join("歌曲.krc");
        let bytes = [b'k', b'r', b'c', b'1', 0xff, 0, 0x80];
        std::fs::write(&binary, bytes).unwrap();
        let fixture_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures");
        let mut track = read_track(&fixture_root.join("测试音楽.wav"), &fixture_root).unwrap();
        track.lyric_ref = Some(binary.to_string_lossy().into_owned());
        let source = read_lyrics(&track).unwrap().unwrap();
        assert_eq!(source.name, "歌曲.krc");
        assert_eq!(source.bytes, bytes);
        std::fs::remove_file(binary).unwrap();
        std::fs::remove_file(lrc).unwrap();
        std::fs::remove_file(ttml).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
    #[test]
    fn unicode_file_index_and_sidecar() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures");
        let track = read_track(&root.join("测试音楽.wav"), &root).expect("index PCM WAV");
        assert_eq!(track.title, "测试音楽");
        assert_eq!(track.duration_ms, 12_000);
        assert!(
            String::from_utf8(read_lyrics(&track).unwrap().unwrap().bytes)
                .unwrap()
                .contains("Hello, world.")
        );
        assert_eq!(
            track.id,
            read_track(&root.join("./测试音楽.wav"), &root).unwrap().id
        );
        assert!(read_track(&root.join("损坏.mp3"), &root).is_err());
        assert!(!supported(&root.join("测试音楽.lrc")));
    }
}
