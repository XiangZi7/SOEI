use crate::model::{AppError, AppResult, Track};
use rusqlite::{params, Connection, OptionalExtension};
use std::{path::Path, sync::Mutex};

pub struct Storage(pub Mutex<Connection>);

impl Storage {
    pub fn open(path: &Path) -> AppResult<Self> {
        let connection = Connection::open(path)?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        Self::migrate(&connection)?;
        Ok(Self(Mutex::new(connection)))
    }
    fn migrate(connection: &Connection) -> AppResult<()> {
        let version: u32 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        if version > 1 {
            return Err(AppError::new(
                "DATABASE_VERSION",
                "数据库版本较新，请使用新版 SOEI",
            ));
        }
        connection.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
            BEGIN;
            CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY, path TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            PRAGMA user_version=1;
            COMMIT;")?;
        Ok(())
    }
    pub fn tracks(&self) -> AppResult<Vec<Track>> {
        let connection = self
            .0
            .lock()
            .map_err(|_| AppError::new("DATABASE", "数据库锁失效"))?;
        let mut statement = connection.prepare("SELECT data FROM tracks ORDER BY rowid")?;
        let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
        rows.map(|row| {
            serde_json::from_str(&row?).map_err(|error| AppError::new("DATABASE_DATA", error))
        })
        .collect()
    }
    pub fn track(&self, id: &str) -> AppResult<Track> {
        let connection = self
            .0
            .lock()
            .map_err(|_| AppError::new("DATABASE", "数据库锁失效"))?;
        let data: Option<String> = connection
            .query_row("SELECT data FROM tracks WHERE id=?1", [id], |row| {
                row.get(0)
            })
            .optional()?;
        serde_json::from_str(&data.ok_or_else(|| AppError::new("TRACK_MISSING", "音乐记录不存在"))?)
            .map_err(|error| AppError::new("DATABASE_DATA", error))
    }
    pub fn save_track(&self, track: &Track) -> AppResult<()> {
        let data =
            serde_json::to_string(track).map_err(|error| AppError::new("SERIALIZE", error))?;
        self.0.lock().map_err(|_| AppError::new("DATABASE", "数据库锁失效"))?.execute(
            "INSERT INTO tracks (id,path,data) VALUES (?1,?2,?3) ON CONFLICT(id) DO UPDATE SET path=excluded.path,data=excluded.data",
            params![track.id, track.local_path, data])?;
        Ok(())
    }
    pub fn settings(&self) -> AppResult<serde_json::Value> {
        let connection = self
            .0
            .lock()
            .map_err(|_| AppError::new("DATABASE", "数据库锁失效"))?;
        let data: Option<String> = connection
            .query_row(
                "SELECT value FROM settings WHERE key='preferences'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        match data {
            Some(data) => {
                serde_json::from_str(&data).map_err(|error| AppError::new("SETTINGS", error))
            }
            None => Ok(serde_json::json!({})),
        }
    }
    pub fn save_settings(&self, value: &serde_json::Value) -> AppResult<()> {
        if value.to_string().len() > 1_000_000 {
            return Err(AppError::new("SETTINGS_SIZE", "设置过大"));
        }
        self.0.lock().map_err(|_| AppError::new("DATABASE", "数据库锁失效"))?.execute(
            "INSERT INTO settings (key,value) VALUES ('preferences',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [value.to_string()])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migration_and_preferences_roundtrip() -> AppResult<()> {
        let connection = Connection::open_in_memory()?;
        Storage::migrate(&connection)?;
        Storage::migrate(&connection)?;
        let store = Storage(Mutex::new(connection));
        store.save_settings(&serde_json::json!({"volume":0.4,"playlists":[]}))?;
        assert_eq!(store.settings()?["volume"], 0.4);
        Ok(())
    }
    #[test]
    fn newer_database_is_preserved() {
        let connection = Connection::open_in_memory().unwrap();
        connection.execute_batch("PRAGMA user_version=2;").unwrap();
        assert!(Storage::migrate(&connection).is_err());
        let version: u32 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 2);
    }
}
