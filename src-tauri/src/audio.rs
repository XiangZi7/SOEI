use crate::model::{AppError, AppResult, PlaybackSnapshot, Track};
use rodio::{Decoder, OutputStreamBuilder, Sink, Source};
use rustfft::{num_complex::Complex, Fft, FftPlanner};
use std::{
    fs::File,
    sync::{
        atomic::{AtomicU32, Ordering},
        mpsc, Arc, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};

pub enum Operation {
    Play(Track),
    Toggle,
    Seek(u64),
    Volume(f32),
    Repeat(String),
    Queue(Vec<Track>),
    Next,
    Previous,
    Stop,
}
type Request = (Operation, mpsc::Sender<AppResult<PlaybackSnapshot>>);

pub struct AudioService {
    sender: mpsc::Sender<Request>,
    snapshot: Arc<Mutex<PlaybackSnapshot>>,
}

impl AudioService {
    pub fn start(app: AppHandle) -> Self {
        let (sender, receiver) = mpsc::channel();
        let snapshot = Arc::new(Mutex::new(PlaybackSnapshot::default()));
        let projection = snapshot.clone();
        std::thread::spawn(move || run(app, receiver, projection));
        Self { sender, snapshot }
    }
    pub fn request(&self, operation: Operation) -> AppResult<PlaybackSnapshot> {
        let (sender, receiver) = mpsc::channel();
        self.sender
            .send((operation, sender))
            .map_err(|_| AppError::new("AUDIO_SERVICE", "音频服务已停止"))?;
        receiver
            .recv_timeout(Duration::from_secs(15))
            .map_err(|_| AppError::new("AUDIO_TIMEOUT", "音频服务响应超时"))?
    }
    pub fn snapshot(&self) -> AppResult<PlaybackSnapshot> {
        self.snapshot
            .lock()
            .map(|value| value.clone())
            .map_err(|_| AppError::new("AUDIO_STATE", "播放状态不可用"))
    }
}

fn run(
    app: AppHandle,
    receiver: mpsc::Receiver<Request>,
    projection: Arc<Mutex<PlaybackSnapshot>>,
) {
    // 输出流只由此线程拥有；所有窗口消费同一份快照，绝不创建音频副本。
    let mut stream = None;
    let mut sink: Option<Sink> = None;
    let mut snapshot = PlaybackSnapshot::default();
    let mut queue: Vec<Track> = vec![];
    let mut history: Vec<Track> = vec![];
    let energy = Arc::new(std::array::from_fn::<_, 4, _>(|_| AtomicU32::new(0)));
    loop {
        match receiver.recv_timeout(Duration::from_millis(125)) {
            Ok((operation, reply)) => {
                let result: AppResult<()> = (|| {
                    match operation {
                        Operation::Play(track) => play(
                            &app,
                            track,
                            &mut stream,
                            &mut sink,
                            &mut snapshot,
                            &mut history,
                            energy.clone(),
                        )?,
                        Operation::Toggle => {
                            if sink.as_ref().is_none_or(|current| current.empty()) {
                                if let Some(track) = queue
                                    .iter()
                                    .find(|track| Some(&track.id) == snapshot.track_id.as_ref())
                                    .cloned()
                                {
                                    play(
                                        &app,
                                        track,
                                        &mut stream,
                                        &mut sink,
                                        &mut snapshot,
                                        &mut history,
                                        energy.clone(),
                                    )?;
                                }
                                return Ok(());
                            }
                            if let Some(sink) = &sink {
                                if sink.is_paused() {
                                    sink.play();
                                    snapshot.status = "playing".into();
                                } else {
                                    sink.pause();
                                    snapshot.status = "paused".into();
                                }
                            }
                        }
                        Operation::Seek(position) => {
                            if let Some(sink) = &sink {
                                sink.try_seek(Duration::from_millis(
                                    position.min(snapshot.duration_ms),
                                ))
                                .map_err(|error| AppError::new("SEEK", error))?;
                                snapshot.position_ms = sink.get_pos().as_millis() as u64;
                            }
                        }
                        Operation::Volume(volume) => {
                            if !volume.is_finite() {
                                return Err(AppError::new("VOLUME", "音量参数无效"));
                            }
                            snapshot.volume = volume.clamp(0.0, 1.0);
                            if let Some(sink) = &sink {
                                sink.set_volume(snapshot.volume);
                            }
                        }
                        Operation::Repeat(mode) => {
                            if !["sequential", "repeat", "one", "shuffle"].contains(&mode.as_str())
                            {
                                return Err(AppError::new("REPEAT", "播放模式无效"));
                            }
                            snapshot.repeat_mode = mode;
                        }
                        Operation::Queue(tracks) => {
                            queue = tracks;
                            snapshot.queue = queue.iter().map(|track| track.id.clone()).collect();
                            if queue.is_empty() {
                                if let Some(current) = sink.take() {
                                    current.stop();
                                }
                                snapshot.status = "stopped".into();
                                snapshot.position_ms = 0;
                                snapshot.energy = [0.0; 4];
                            }
                        }
                        Operation::Next => {
                            if let Some(track) = next(&queue, &snapshot, false) {
                                play(
                                    &app,
                                    track,
                                    &mut stream,
                                    &mut sink,
                                    &mut snapshot,
                                    &mut history,
                                    energy.clone(),
                                )?;
                            } else {
                                if let Some(sink) = sink.take() {
                                    sink.stop();
                                }
                                snapshot.status = "stopped".into();
                            }
                        }
                        Operation::Previous => {
                            let track = history.pop();
                            if let Some(track) = track {
                                let mut ignored = vec![];
                                play(
                                    &app,
                                    track,
                                    &mut stream,
                                    &mut sink,
                                    &mut snapshot,
                                    &mut ignored,
                                    energy.clone(),
                                )?;
                            } else if let Some(sink) = &sink {
                                let _ = sink.try_seek(Duration::ZERO);
                            }
                        }
                        Operation::Stop => {
                            if let Some(sink) = sink.take() {
                                sink.stop();
                            }
                            snapshot.status = "stopped".into();
                            snapshot.position_ms = 0;
                        }
                    }
                    Ok(())
                })();
                if let Err(error) = &result {
                    snapshot.error = Some(error.message.clone());
                } else {
                    snapshot.error = None;
                }
                publish(&app, &projection, &mut snapshot);
                let _ = reply.send(result.map(|()| snapshot.clone()));
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                if let Some(current) = &sink {
                    snapshot.position_ms =
                        (current.get_pos().as_millis() as u64).min(snapshot.duration_ms);
                    for (index, value) in energy.iter().enumerate() {
                        snapshot.energy[index] = if current.is_paused() {
                            0.0
                        } else {
                            f32::from_bits(value.load(Ordering::Relaxed))
                        };
                    }
                    if current.empty() && snapshot.status == "playing" {
                        if let Some(track) = next(&queue, &snapshot, true) {
                            if let Err(error) = play(
                                &app,
                                track,
                                &mut stream,
                                &mut sink,
                                &mut snapshot,
                                &mut history,
                                energy.clone(),
                            ) {
                                snapshot.status = "stopped".into();
                                snapshot.error = Some(error.message);
                            }
                        } else {
                            snapshot.status = "stopped".into();
                            snapshot.energy = [0.0; 4];
                        }
                    }
                    publish(&app, &projection, &mut snapshot);
                }
            }
        }
    }
}

fn next(queue: &[Track], state: &PlaybackSnapshot, ended: bool) -> Option<Track> {
    if queue.is_empty() {
        return None;
    }
    let index = queue
        .iter()
        .position(|track| Some(&track.id) == state.track_id.as_ref());
    if state.repeat_mode == "one" && ended {
        return index.map(|index| queue[index].clone());
    }
    if state.repeat_mode == "shuffle" {
        let candidates: Vec<_> = queue
            .iter()
            .filter(|track| Some(&track.id) != state.track_id.as_ref())
            .collect();
        return if candidates.is_empty() {
            Some(queue[0].clone())
        } else {
            Some(candidates[rand::random_range(0..candidates.len())].clone())
        };
    }
    let candidate = index.map_or(0, |index| index + 1);
    if candidate < queue.len() {
        Some(queue[candidate].clone())
    } else if state.repeat_mode == "repeat" || !ended {
        Some(queue[0].clone())
    } else {
        None
    }
}

fn play(
    app: &AppHandle,
    track: Track,
    stream: &mut Option<rodio::OutputStream>,
    sink: &mut Option<Sink>,
    state: &mut PlaybackSnapshot,
    history: &mut Vec<Track>,
    energy: Arc<[AtomicU32; 4]>,
) -> AppResult<()> {
    // 解码和输出流准备成功后才停旧歌，损坏的新文件不能破坏已有播放。
    let decoder = Decoder::try_from(File::open(&track.local_path)?)
        .map_err(|error| AppError::new("DECODE", format!("无法播放 {}：{error}", track.title)))?;
    let duration = decoder
        .total_duration()
        .map(|value| value.as_millis() as u64)
        .unwrap_or(track.duration_ms);
    if stream.is_none() {
        *stream = Some(
            OutputStreamBuilder::open_default_stream()
                .map_err(|error| AppError::new("AUDIO_DEVICE", error))?,
        );
    }
    let output = stream
        .as_ref()
        .ok_or_else(|| AppError::new("AUDIO_DEVICE", "未找到输出设备"))?;
    let prepared = Sink::connect_new(output.mixer());
    prepared.pause();
    prepared.set_volume(state.volume);
    prepared.append(AnalyzedSource::new(decoder, energy));
    if let Some(old) = sink.take() {
        old.stop();
    }
    if let Some(id) = &state.track_id {
        if let Ok(previous) = app.state::<crate::AppState>().storage.track(id) {
            history.push(previous);
        }
    }
    if history.len() > 1000 {
        history.remove(0);
    }
    prepared.play();
    *sink = Some(prepared);
    state.session_id += 1;
    state.track_id = Some(track.id.clone());
    state.position_ms = 0;
    state.duration_ms = duration;
    state.status = "playing".into();
    state.energy = [0.0; 4];
    if let Ok(updated) = record_playback(&app.state::<crate::AppState>().storage, track) {
        let _ = app.emit_to("main", "library:track", updated);
    }
    Ok(())
}

fn record_playback(storage: &crate::storage::Storage, track: Track) -> AppResult<Track> {
    let last_played = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|value| value.as_secs());
    storage.update_last_played(&track.id, last_played)
}

fn publish(app: &AppHandle, projection: &Mutex<PlaybackSnapshot>, snapshot: &mut PlaybackSnapshot) {
    snapshot.revision += 1;
    if let Ok(mut target) = projection.lock() {
        *target = snapshot.clone();
    }
    let _ = app.emit("player:state", &snapshot);
}

struct AnalyzedSource<S> {
    inner: S,
    energy: Arc<[AtomicU32; 4]>,
    fft: Arc<dyn Fft<f32>>,
    buffer: Vec<Complex<f32>>,
    scratch: Vec<Complex<f32>>,
    offset: usize,
    channel: u16,
    mono: f32,
}
impl<S: Source<Item = f32>> AnalyzedSource<S> {
    fn new(inner: S, energy: Arc<[AtomicU32; 4]>) -> Self {
        let fft = FftPlanner::new().plan_fft_forward(2048);
        let scratch = vec![Complex::default(); fft.get_inplace_scratch_len()];
        Self {
            inner,
            energy,
            fft,
            buffer: vec![Complex::default(); 2048],
            scratch,
            offset: 0,
            channel: 0,
            mono: 0.0,
        }
    }
}
impl<S: Source<Item = f32>> Iterator for AnalyzedSource<S> {
    type Item = f32;
    fn next(&mut self) -> Option<f32> {
        let sample = self.inner.next()?;
        self.mono += sample;
        self.channel += 1;
        if self.channel >= self.inner.channels() {
            let value = self.mono / self.channel as f32;
            self.buffer[self.offset] = Complex::new(value, 0.0);
            self.offset += 1;
            self.mono = 0.0;
            self.channel = 0;
            if self.offset == self.buffer.len() {
                let rms = (self
                    .buffer
                    .iter()
                    .map(|value| value.re * value.re)
                    .sum::<f32>()
                    / 2048.0)
                    .sqrt();
                for (index, value) in self.buffer.iter_mut().enumerate() {
                    value.re *= 0.5 - 0.5 * (std::f32::consts::TAU * index as f32 / 2047.0).cos();
                }
                self.fft
                    .process_with_scratch(&mut self.buffer, &mut self.scratch);
                let mut bands = [0.0_f32; 3];
                for (index, value) in self.buffer.iter().take(1024).enumerate().skip(1) {
                    let frequency = index as f32 * self.inner.sample_rate() as f32 / 2048.0;
                    let band = if frequency < 250.0 {
                        0
                    } else if frequency < 4000.0 {
                        1
                    } else {
                        2
                    };
                    bands[band] += value.norm_sqr();
                }
                let values = [
                    rms * 3.0,
                    bands[0].sqrt() / 400.0,
                    bands[1].sqrt() / 400.0,
                    bands[2].sqrt() / 400.0,
                ];
                for (target, value) in self.energy.iter().zip(values) {
                    let previous = f32::from_bits(target.load(Ordering::Relaxed));
                    target.store(
                        (previous * 0.65 + value.clamp(0.0, 1.0) * 0.35).to_bits(),
                        Ordering::Relaxed,
                    );
                }
                self.offset = 0;
            }
        }
        Some(sample)
    }
}
impl<S: Source<Item = f32>> Source for AnalyzedSource<S> {
    fn current_span_len(&self) -> Option<usize> {
        self.inner.current_span_len()
    }
    fn channels(&self) -> u16 {
        self.inner.channels()
    }
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }
    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }
    fn try_seek(&mut self, position: Duration) -> Result<(), rodio::source::SeekError> {
        self.offset = 0;
        self.channel = 0;
        self.mono = 0.0;
        self.inner.try_seek(position)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn track(id: &str) -> Track {
        Track {
            id: id.into(),
            local_path: String::new(),
            title: id.into(),
            artist: String::new(),
            album: String::new(),
            duration_ms: 1000,
            cover_ref: None,
            lyric_ref: None,
            favorite: false,
            last_played: None,
        }
    }
    #[test]
    fn queued_playback_preserves_updated_favorite_and_lyrics() -> AppResult<()> {
        let connection = rusqlite::Connection::open_in_memory()?;
        connection.execute_batch(
            "CREATE TABLE tracks (id TEXT PRIMARY KEY, path TEXT UNIQUE NOT NULL, data TEXT NOT NULL);",
        )?;
        let storage = crate::storage::Storage(Mutex::new(connection));
        let mut queued_track = track("b");
        queued_track.local_path = "b.wav".into();
        storage.save_track(&queued_track)?;
        let queue = vec![track("a"), queued_track];

        let mut latest = storage.track("b")?;
        latest.favorite = true;
        latest.lyric_ref = Some("custom.lrc".into());
        latest.title = "Updated title".into();
        latest.cover_ref = Some("updated-cover.jpg".into());
        storage.save_track(&latest)?;

        let snapshot = PlaybackSnapshot {
            track_id: Some("a".into()),
            ..Default::default()
        };
        let upcoming = next(&queue, &snapshot, true).expect("queued next track");
        let updated = record_playback(&storage, upcoming)?;
        assert!(
            updated.favorite,
            "queued playback must preserve a new favorite"
        );
        assert_eq!(updated.lyric_ref, latest.lyric_ref);
        assert!(updated.last_played.is_some());
        latest.last_played = updated.last_played;
        assert_eq!(
            serde_json::to_value(&updated).unwrap(),
            serde_json::to_value(&latest).unwrap(),
            "the emitted track must include all current metadata"
        );
        assert_eq!(
            serde_json::to_value(storage.track("b")?).unwrap(),
            serde_json::to_value(&latest).unwrap(),
            "playback must persist only the last-played change"
        );
        Ok(())
    }
    #[test]
    fn queue_end_modes() {
        let queue = vec![track("a"), track("b")];
        let mut state = PlaybackSnapshot {
            track_id: Some("b".into()),
            ..Default::default()
        };
        assert!(next(&queue, &state, true).is_none());
        state.repeat_mode = "repeat".into();
        assert_eq!(
            next(&queue, &state, true).map(|track| track.id),
            Some("a".into())
        );
        state.repeat_mode = "one".into();
        assert_eq!(
            next(&queue, &state, true).map(|track| track.id),
            Some("b".into())
        );
        assert!(next(&[], &state, false).is_none());
    }
    #[test]
    fn wav_decode_seek_and_pcm_analysis() {
        let path =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/测试音楽.wav");
        let mut decoder = Decoder::try_from(File::open(path).unwrap()).expect("decode WAV");
        assert_eq!(decoder.total_duration().unwrap().as_millis(), 12_000);
        decoder
            .try_seek(Duration::from_millis(6500))
            .expect("seek WAV");
        assert!(decoder.next().is_some());
        let energy = Arc::new(std::array::from_fn(|_| AtomicU32::new(0)));
        let mut source = AnalyzedSource::new(decoder, energy.clone());
        for _ in 0..4096 {
            assert!(source.next().is_some());
        }
        let rms = f32::from_bits(energy[0].load(Ordering::Relaxed));
        assert!(rms > 0.0 && rms <= 1.0, "真实 PCM 能量应为有限的限幅值");
        source
            .try_seek(Duration::ZERO)
            .expect("seek analyzed source");
        assert!(source.next().is_some());
        assert!(Decoder::try_from(std::io::Cursor::new(b"corrupted audio")).is_err());
    }
    #[test]
    #[ignore = "需要当前 Windows 会话具备可用音频输出设备"]
    fn native_output_seek_pause_resume() {
        let stream = OutputStreamBuilder::open_default_stream().expect("open audio device");
        let sink = Sink::connect_new(stream.mixer());
        sink.set_volume(0.0);
        let path =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../public/demo/soei-test.wav");
        sink.append(Decoder::try_from(File::open(path).unwrap()).unwrap());
        std::thread::sleep(Duration::from_millis(180));
        assert!(!sink.empty());
        assert!(sink.get_pos() > Duration::ZERO);
        sink.pause();
        std::thread::sleep(Duration::from_millis(80));
        let paused = sink.get_pos();
        std::thread::sleep(Duration::from_millis(160));
        assert_eq!(sink.get_pos(), paused);
        sink.try_seek(Duration::from_millis(6500))
            .expect("native seek");
        sink.play();
        std::thread::sleep(Duration::from_millis(160));
        assert!(sink.get_pos() >= Duration::from_millis(6500));
        sink.try_seek(Duration::from_millis(1000))
            .expect("backward native seek");
        assert!(sink.get_pos() < Duration::from_millis(2000));
        sink.stop();
        // stop 在设备的下一次回调中生效，不能把控制请求当作已消费的结果。
        for _ in 0..50 {
            if sink.empty() {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(sink.empty());
    }
}
