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
  /**
   * [总能量, bass, lowMid, mid, vocal, treble]，与 src-tauri/src/audio.rs 的 ENERGY_SLOTS 对应。
   * 频段划分对齐 Folia 的 AudioBands；mid(400-1200) 与 vocal(1000-3500) 刻意重叠。
   */
  energy: number[]
  error: string | null
}
export interface LyricRuby {
  text: string
  startMs: number
  endMs: number
}
export interface LyricSyllable extends LyricRuby {
  endsWithSpace?: boolean
  ruby?: LyricRuby[]
  obscene?: boolean
  emptyBeat?: number
}
export interface LyricAlternateText {
  role: string
  language?: string
  text: string
  syllables?: LyricSyllable[]
}
export interface LyricWord {
  text: string
  startMs: number
  endMs?: number
  syllables?: LyricSyllable[]
}
export interface LyricBackgroundVocal {
  text: string
  startMs: number
  endMs: number
  words: LyricWord[]
  agentId?: string
  translation?: string
  romanization?: string
  alternateTexts?: LyricAlternateText[]
}
export interface LyricRenderHints {
  rawDurationMs: number
  renderEndMs: number
  timingClass: 'normal' | 'short' | 'micro'
  lineTransitionMode: 'normal' | 'fast' | 'none'
  wordRevealMode: 'normal' | 'fast' | 'instant'
}
export interface LyricLine {
  id: string
  startMs: number
  endMs?: number
  text: string
  words?: LyricWord[]
  timing?: 'line' | 'word'
  translation?: string
  romanization?: string
  alternateTexts?: LyricAlternateText[]
  backgroundVocals?: LyricBackgroundVocal[]
  agentId?: string
  songPart?: string
  blockIndex?: number
  isChorus?: boolean
  chorusEffect?: 'bars' | 'circles' | 'beams'
  wordSegments?: string[]
  renderHints?: LyricRenderHints
}
export type LyricFormat =
  'lrc' | 'enhanced-lrc' | 'vtt' | 'ttml' | 'yrc' | 'qrc' | 'krc' | 'awlrc'
export type SubtitleContentMode =
  'translation' | 'romanization' | 'both' | 'none'
export interface LyricDocument {
  lines: LyricLine[]
  format: LyricFormat
  title?: string
  artist?: string
  isWordByWord: boolean
  error?: string
  ttml?: {
    timingMode?: 'Word' | 'Line'
    agents?: Record<string, { id: string; name?: string; type?: string }>
  }
}
/** Native IPC transports bytes so encrypted KRC and legacy encodings survive intact. */
export type LyricFileSource = string | { name: string; bytes: number[] }
export type LibraryTab = 'all' | 'albums' | 'artists' | 'playlists'
/** SOEI 原有的纯 CSS/DOM 场景。 */
export type LegacySceneLayout =
  | 'manuscript'
  | 'artistic'
  | 'collage'
  | 'echo'
  | 'montage'
  | 'readable'
  | 'title'
/**
 * 从 Folia 移植的 visualizer 模式 id，与 features/visualizer/<mode>/entry.ts 一一对应。
 * 模式落地时才加进这个联合 —— 类型不应声称存在还没实现的模式。
 * 目标集合（14 个）见 docs/LYRICS_ENGINE.md 的移植计划。
 */
export type VisualizerLayout =
  'still' | 'classic' | 'tilt' | 'partita' | 'claddagh' | 'cadenza'
export type SceneLayout = LegacySceneLayout | VisualizerLayout
export interface Playlist {
  id: string
  name: string
  trackIds: string[]
}
export interface Preferences {
  showTitles: boolean
  reducedMotion: boolean
  layout: SceneLayout
  sceneSeed: number
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
  visualizerTunings?: Record<string, unknown>
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
