export interface ArtworkCrop {
  source: string
  x: number
  y: number
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
}
export interface Track {
  id: string
  localPath: string
  title: string
  artist: string
  album: string
  durationMs: number
  coverRef: string | null
  lyricRef: string | null
  favorite: boolean
  lastPlayed: number | null
  artwork?: ArtworkCrop
  demo?: boolean
  color?: string
}
export interface PlaybackSnapshot {
  sessionId: number
  revision: number
  trackId: string | null
  status: string
  positionMs: number
  durationMs: number
  volume: number
  repeatMode: string
  queue: string[]
  energy: number[]
  error: string | null
}
export interface LyricLine {
  id: string
  startMs: number
  text: string
}
export type LibraryTab = 'all' | 'albums' | 'artists' | 'playlists'
export type SceneLayout = 'artistic' | 'readable' | 'title'
export interface Playlist {
  id: string
  name: string
  trackIds: string[]
}
export interface Preferences {
  showTitles: boolean
  reducedMotion: boolean
  layout: SceneLayout
  lyricSize: number
  lyricOffset: number
  quality: 'high' | 'balanced' | 'power'
  closeToTray: boolean
  background: string
  language: 'zh-CN' | 'en' | 'ja'
  playlists: Playlist[]
  queue: string[]
  trackOffsets: Record<string, number>
  trackBackgrounds: Record<string, string>
}
export interface Display {
  id: string
  name: string
  width: number
  height: number
  x: number
  y: number
  scale: number
}
export interface WallpaperStatus {
  enabled: string[]
  error: string | null
}
export interface ScanProgress {
  running: boolean
  scanned: number
  imported: number
  errors: string[]
  cancelled: boolean
}
