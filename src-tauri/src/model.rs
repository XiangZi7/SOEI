use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub local_path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub cover_ref: Option<String>,
    pub lyric_ref: Option<String>,
    pub favorite: bool,
    pub last_played: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackSnapshot {
    pub session_id: u64,
    pub revision: u64,
    pub track_id: Option<String>,
    pub status: String,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub volume: f32,
    pub repeat_mode: String,
    pub queue: Vec<String>,
    pub energy: [f32; 4],
    pub error: Option<String>,
}

impl Default for PlaybackSnapshot {
    fn default() -> Self {
        Self {
            session_id: 0,
            revision: 0,
            track_id: None,
            status: "stopped".into(),
            position_ms: 0,
            duration_ms: 0,
            volume: 0.65,
            repeat_mode: "sequential".into(),
            queue: vec![],
            energy: [0.0; 4],
            error: None,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}

impl AppError {
    pub fn new(code: &str, message: impl ToString) -> Self {
        Self {
            code: code.into(),
            message: message.to_string(),
            recoverable: true,
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::new("DATABASE", error)
    }
}
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::new("FILE", error)
    }
}
pub type AppResult<T> = Result<T, AppError>;
